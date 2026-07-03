/* CSSOS_WAVE_230 20260518 — Jing
 *
 * Hover-affordance Edit / Refine buttons on every work-card title.
 *
 * UX:
 *   - Hover any [data-editable-title] → two 18px icon buttons float
 *     to the right: ✏️ (rename) ✨ (re-derive from lyrics)
 *   - ✏️ Edit  → title cell becomes contentEditable; Enter OR blur
 *     saves via POST /api/works/:id/title. Esc cancels.
 *   - ✨ Refine → client-side heuristic over the work's lyrics_preview
 *     (most-repeated short line ≈ chorus hook), saves the same way.
 *
 * Owner-only: server enforces, but we hide buttons when work-card
 * has no owner match. (Quick check: data-owner-self attr on card, set
 * elsewhere; absence → buttons still shown, server rejects gracefully.)
 *
 * Event-delegated, zero per-render cost. Loads once.
 */
(function () {
  "use strict";
  if (globalThis.__cssosTitleEditRefineWired) return;
  globalThis.__cssosTitleEditRefineWired = true;

  function injectStyles() {
    if (document.getElementById("cssos-title-edit-refine-style")) return;
    var st = document.createElement("style");
    st.id = "cssos-title-edit-refine-style";
    st.textContent = [
      /* CSSOS_WAVE_231 — Jing 再次确认: 按钮紧跟标题文字尾部. 强制
       * position:static + right:auto 兜底覆盖任何残留旧规则. */
      "[data-editable-title] .cssos-title-actions{",
      "  display:none !important;position:static !important;right:auto !important;",
      "  transform:none !important;gap:3px;align-items:center;vertical-align:middle;",
      "  margin-left:6px;background:rgba(0,0,0,0.62);padding:2px 5px;",
      "  border-radius:7px;backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);",
      "}",
      "[data-editable-title]:hover .cssos-title-actions{display:inline-flex !important;}",
      "[data-editable-title] .cssos-title-actions button{",
      "  background:transparent;border:0;color:#daffee;font-size:13px;",
      "  cursor:pointer;padding:2px 4px;line-height:1;border-radius:4px;",
      "  transition:background .15s;",
      "}",
      "[data-editable-title] .cssos-title-actions button:hover{",
      "  background:rgba(0,245,160,0.22);",
      "}",
      "[data-editable-title][contenteditable=\"true\"]{",
      "  outline:1.5px solid rgba(0,245,160,0.85);border-radius:4px;",
      "  padding:2px 4px;background:rgba(0,245,160,0.08);",
      "}",
    ].join("\n");
    document.head.appendChild(st);
  }

  function findWorkId(titleEl) {
    var card = titleEl.closest("[data-work-id]");
    if (card) return String(card.getAttribute("data-work-id") || "").trim();
    return "";
  }

  function findLyrics(titleEl) {
    var card = titleEl.closest("[data-work-id]");
    if (!card) return "";
    // Preferred: data-lyrics-preview attr on the card (W230b).
    var ds = card.getAttribute("data-lyrics-preview");
    if (ds && ds.trim()) return ds.trim();
    // Fallbacks for older markup.
    var preview = card.querySelector(".work-extra, .work-lyrics-preview, .work-preview");
    if (preview && preview.textContent) return String(preview.textContent).trim();
    return "";
  }

  /* Client-side heuristic: most-repeated short line ≈ chorus hook → title.
   * Falls back to first non-empty line if no clear winner. Caps at 6 words. */
  function refineTitleFromLyrics(lyrics) {
    var raw = String(lyrics || "").trim();
    if (!raw) return "";
    var lines = raw.split(/\r?\n/)
      .map(function (s) { return s.trim(); })
      .filter(function (s) { return s && !/^\[.*\]$/.test(s); }); // drop [Verse 1] markers
    if (!lines.length) return "";
    var counts = {};
    lines.forEach(function (line) {
      var key = line.toLowerCase().replace(/[，。！？,.!?;:、—–-]/g, "").trim();
      if (!key || key.length < 3) return;
      counts[key] = (counts[key] || 0) + 1;
    });
    var bestKey = "", bestCount = 0;
    Object.keys(counts).forEach(function (k) {
      if (counts[k] > bestCount) { bestCount = counts[k]; bestKey = k; }
    });
    var pick = "";
    if (bestCount >= 2) {
      for (var i = 0; i < lines.length; i++) {
        var key = lines[i].toLowerCase().replace(/[，。！？,.!?;:、—–-]/g, "").trim();
        if (key === bestKey) { pick = lines[i]; break; }
      }
    }
    if (!pick) pick = lines[0];
    // Strip leading articles + punctuation tail, cap to 6 words / 30 chars.
    pick = pick.replace(/^(a|an|the)\s+/i, "").replace(/[，。！？,.!?;:]+$/, "").trim();
    var isCjk = /[一-鿿぀-ヿ가-힯]/.test(pick);
    if (isCjk) {
      var chars = [].slice.call(pick);
      if (chars.length > 12) pick = chars.slice(0, 12).join("");
    } else {
      var words = pick.split(/\s+/);
      if (words.length > 6) pick = words.slice(0, 6).join(" ");
      if (pick.length > 30) pick = pick.slice(0, 30).trim();
    }
    return pick;
  }

  async function saveTitle(workId, newTitle, titleEl) {
    // 防御: 占位符/非法 workId(如字面 "#") 不发请求 → 避免 404 /api/works/#/title(自愈 06-03)。
    var _wid = String(workId == null ? "" : workId).trim();
    if (!_wid || _wid === "#" || _wid.indexOf("#") !== -1 || _wid.indexOf("/") !== -1) {
      // No / invalid workId → local-only update (e.g. transient cards).
      titleEl.textContent = newTitle;
      titleEl.__cssosTitleActionsAttached = false;
      attachActions(titleEl);
      return true;
    }
    try {
      var r = await fetch("/api/works/" + encodeURIComponent(workId) + "/title", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: newTitle }),
      });
      var j = await r.json().catch(function () { return null; });
      if (r.ok && j && j.ok) {
        titleEl.textContent = j.title || newTitle;
        /* W230c — textContent 把 actions 子节点也清掉了,
         * 必须把 attached flag 重置并立刻重挂, 否则下次 hover 没按钮. */
        titleEl.__cssosTitleActionsAttached = false;
        attachActions(titleEl);
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast("✓ " + (j.title || newTitle));
        }
        return true;
      }
      // 把后端错误码翻成人话, 让用户知道"为什么存不了"(最常见: 不是你的作品)。
      var code = (j && j.error) || String(r.status);
      var msg = code === "not_found_or_not_owner"
        ? (globalThis.loginCopy ? globalThis.loginCopy("You can only rename your own works.", "只能重命名你自己的作品。") : "You can only rename your own works.")
        : code === "sign_in_required"
          ? (globalThis.loginCopy ? globalThis.loginCopy("Sign in to rename.", "登录后才能改名。") : "Sign in to rename.")
          : "Rename failed: " + code;
      if (typeof globalThis.showToast === "function") globalThis.showToast(msg);
      return false;
    } catch (err) {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast("Rename failed: " + (err && err.message));
      }
      return false;
    }
  }

  function attachActions(titleEl) {
    if (titleEl.__cssosTitleActionsAttached) return;
    titleEl.__cssosTitleActionsAttached = true;
    var wrap = document.createElement("span");
    wrap.className = "cssos-title-actions";
    wrap.setAttribute("contenteditable", "false");
    wrap.innerHTML = ''
      + '<button type="button" data-act="edit"   title="Edit title">✏️</button>'
      + '<button type="button" data-act="refine" title="Refine title from lyrics">✨</button>';
    titleEl.appendChild(wrap);
    wrap.addEventListener("click", function (ev) {
      var btn = ev.target.closest("button[data-act]");
      if (!btn) return;
      ev.stopPropagation();
      ev.preventDefault();
      if (btn.dataset.act === "edit") {
        enterEditMode(titleEl);
      } else if (btn.dataset.act === "refine") {
        var lyrics = findLyrics(titleEl);
        if (!lyrics) {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast("No lyrics found to refine from.");
          }
          return;
        }
        var picked = refineTitleFromLyrics(lyrics);
        if (!picked) {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast("Couldn't extract a clean title — try Edit instead.");
          }
          return;
        }
        var workId = findWorkId(titleEl);
        void saveTitle(workId, picked, titleEl);
      }
    });
  }

  function getPlainText(titleEl) {
    // textContent includes the actions span text. Strip it.
    var actions = titleEl.querySelector(".cssos-title-actions");
    var text = "";
    [].forEach.call(titleEl.childNodes, function (n) {
      if (n === actions) return;
      text += n.textContent || n.nodeValue || "";
    });
    return text.trim();
  }

  function enterEditMode(titleEl) {
    if (titleEl.getAttribute("contenteditable") === "true") return;
    var original = getPlainText(titleEl);
    // Remove the actions while editing so they don't get pulled into content.
    var actions = titleEl.querySelector(".cssos-title-actions");
    if (actions) actions.remove();
    titleEl.textContent = original;
    titleEl.setAttribute("contenteditable", "true");
    titleEl.focus();
    // Select all so user can type-over.
    try {
      var range = document.createRange();
      range.selectNodeContents(titleEl);
      var sel = window.getSelection();
      sel.removeAllRanges();
      sel.addRange(range);
    } catch (_e) {}

    var saved = false;
    var commit = async function () {
      if (saved) return;
      saved = true;
      var newTitle = titleEl.textContent.trim();
      titleEl.setAttribute("contenteditable", "false");
      titleEl.__cssosTitleActionsAttached = false;
      attachActions(titleEl);
      if (newTitle && newTitle !== original) {
        var workId = findWorkId(titleEl);
        await saveTitle(workId, newTitle, titleEl);
      } else {
        titleEl.textContent = original;
        titleEl.__cssosTitleActionsAttached = false;
        attachActions(titleEl);
      }
    };
    var cancel = function () {
      if (saved) return;
      saved = true;
      titleEl.setAttribute("contenteditable", "false");
      titleEl.textContent = original;
      titleEl.__cssosTitleActionsAttached = false;
      attachActions(titleEl);
    };
    titleEl.addEventListener("keydown", function onKey(ev) {
      if (ev.key === "Enter") {
        ev.preventDefault();
        titleEl.removeEventListener("keydown", onKey);
        titleEl.blur();
        void commit();
      } else if (ev.key === "Escape") {
        ev.preventDefault();
        titleEl.removeEventListener("keydown", onKey);
        cancel();
        titleEl.blur();
      }
    });
    titleEl.addEventListener("blur", function onBlur() {
      titleEl.removeEventListener("blur", onBlur);
      void commit();
    });
    // Don't let clicks inside editing bubble up to data-work-toggle handlers.
    var stop = function (ev) { ev.stopPropagation(); };
    titleEl.addEventListener("click", stop);
    setTimeout(function () { titleEl.removeEventListener("click", stop); }, 10000);
  }

  // Public API.
  globalThis.mountTitleEditRefineModule = function (titleEl /*, workId */) {
    if (!titleEl) return;
    titleEl.setAttribute("data-editable-title", "");
    attachActions(titleEl);
  };

  // Event-delegated attach: any mouseover on [data-editable-title]
  // ensures buttons exist. Cheap, idempotent.
  function tryAttach(el) {
    if (!el || !el.matches || !el.matches("[data-editable-title]")) return;
    attachActions(el);
  }
  document.addEventListener("mouseover", function (ev) {
    var t = ev.target;
    if (!t || !t.closest) return;
    var el = t.closest("[data-editable-title]");
    if (el) tryAttach(el);
  });
  // Initial sweep + MutationObserver for newly-rendered cards.
  function sweep() {
    document.querySelectorAll("[data-editable-title]").forEach(tryAttach);
  }
  injectStyles();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", sweep);
  } else {
    sweep();
  }
  try {
    var mo = new MutationObserver(function () { sweep(); });
    mo.observe(document.body, { subtree: true, childList: true });
  } catch (_e) {}
})();
