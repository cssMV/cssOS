/* CSSOS_ENGINE_PICKER 20260506 — Jing
 *
 * Open-system control panel for the unified routers. Fetches
 * /api/llm/providers (returns LLM/IMAGE/MUSIC/VIDEO/TTS provider
 * matrix) and lets the user reorder / disable per kind. Writes the
 * order to cookies; the server reads them via userPreferredOrder()
 * and overrides the env default for that user's requests.
 *
 * Open with `cssosEnginePicker.open()` or by clicking a top-bar
 * "engines" button (added to the dock if data-action="engines"
 * exists, otherwise via globalThis.cssosEnginePicker.open()).
 *
 * Cookie keys:
 *   cssos_llm_prefer    cssos_image_prefer    cssos_music_prefer
 *   cssos_video_prefer  cssos_tts_prefer
 * Format: comma-separated provider IDs in priority order. Server
 * filters out unknown / non-configured ones.
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

  function readCookie(name) {
    var match = document.cookie.match(new RegExp("(^|; )" + name + "=([^;]+)"));
    return match ? decodeURIComponent(match[2]) : "";
  }
  function writeCookie(name, value) {
    var oneYear = 60 * 60 * 24 * 365;
    document.cookie = name + "=" + encodeURIComponent(value) + "; path=/; max-age=" + oneYear + "; SameSite=Lax";
  }

  var KIND_LABEL = {
    llm:   tt("LLM (chat / lyrics / prompts)", "LLM (聊天/歌词/提示语)"),
    image: tt("Image generation",              "图像生成"),
    music: tt("Music generation",              "音乐生成"),
    video: tt("Video generation",              "视频生成"),
    tts:   tt("Text-to-speech",                "文字转语音"),
  };

  var overlay = null;

  async function loadProviders() {
    var res = await fetch("/api/llm/providers", { credentials: "include" });
    var json = await res.json().catch(function () { return null; });
    return (json && (json.data || json)) || null;
  }

  function buildKindCard(kind, snapshot) {
    var card = document.createElement("div");
    card.style.cssText =
      "padding:14px;border-radius:12px;background:rgba(8,18,16,0.92);" +
      "border:1px solid rgba(0,245,160,0.3);";
    var title = document.createElement("div");
    title.textContent = KIND_LABEL[kind] || kind;
    title.style.cssText = "font:700 13px/1 ui-monospace,monospace;letter-spacing:.06em;color:#00f5a0;text-transform:uppercase;margin-bottom:10px;";
    card.appendChild(title);

    var providers = snapshot.providers.slice();
    var cookieKey = "cssos_" + kind + "_prefer";
    var cookieOrder = readCookie(cookieKey).split(",").filter(Boolean);
    // Effective order = cookie if set, else server's default_order.
    var effective = cookieOrder.length ? cookieOrder : snapshot.default_order;
    // Sort the providers list so effective ones come first in their
    // chosen order, then the rest at the bottom.
    providers.sort(function (a, b) {
      var aIdx = effective.indexOf(a.id);
      var bIdx = effective.indexOf(b.id);
      if (aIdx === -1 && bIdx === -1) return 0;
      if (aIdx === -1) return 1;
      if (bIdx === -1) return -1;
      return aIdx - bIdx;
    });

    var list = document.createElement("ul");
    list.style.cssText = "list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:6px;";
    var enabled = new Set(effective);

    function rerenderAndPersist() {
      var next = Array.from(list.children).filter(function (li) {
        return li.dataset.enabled === "1";
      }).map(function (li) { return li.dataset.id; });
      writeCookie(cookieKey, next.join(","));
    }

    providers.forEach(function (p, idx) {
      var li = document.createElement("li");
      li.dataset.id = p.id;
      li.dataset.enabled = enabled.has(p.id) ? "1" : "0";
      li.style.cssText =
        "display:flex;align-items:center;gap:10px;padding:8px 10px;" +
        "border-radius:8px;background:rgba(0,245,160,0.08);" +
        "border:1px solid rgba(0,245,160,0.2);" +
        "opacity:" + (p.configured ? "1" : "0.45") + ";";
      // Toggle checkbox.
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.checked = enabled.has(p.id);
      cb.disabled = !p.configured;
      cb.style.cssText = "accent-color:#00f5a0;";
      cb.addEventListener("change", function () {
        li.dataset.enabled = cb.checked ? "1" : "0";
        rerenderAndPersist();
      });
      li.appendChild(cb);
      // Order arrows.
      var up = document.createElement("button");
      up.type = "button";
      up.textContent = "▲";
      up.style.cssText = "background:transparent;border:0;color:rgba(218,255,238,0.55);cursor:pointer;font:700 10px/1 ui-monospace,monospace;";
      up.addEventListener("click", function () {
        var prev = li.previousElementSibling;
        if (prev) { list.insertBefore(li, prev); rerenderAndPersist(); }
      });
      li.appendChild(up);
      var down = document.createElement("button");
      down.type = "button";
      down.textContent = "▼";
      down.style.cssText = "background:transparent;border:0;color:rgba(218,255,238,0.55);cursor:pointer;font:700 10px/1 ui-monospace,monospace;";
      down.addEventListener("click", function () {
        var next = li.nextElementSibling;
        if (next) { list.insertBefore(next, li); rerenderAndPersist(); }
      });
      li.appendChild(down);
      // Name + meta.
      var name = document.createElement("div");
      name.style.cssText = "flex:1;display:flex;flex-direction:column;gap:2px;";
      var primary = document.createElement("div");
      primary.textContent = p.id + " · " + p.default_model;
      primary.style.cssText = "font:600 12px/1.2 ui-monospace,monospace;color:#daffee;";
      var sub = document.createElement("div");
      var bits = [];
      if (p.free_tier) bits.push(tt("free", "免费档"));
      if (!p.configured) bits.push(tt("not configured", "未配置"));
      sub.textContent = bits.join(" · ");
      sub.style.cssText = "font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.5);";
      name.appendChild(primary);
      if (bits.length) name.appendChild(sub);
      li.appendChild(name);
      list.appendChild(li);
    });
    card.appendChild(list);

    var hint = document.createElement("div");
    hint.textContent = tt(
      "Drag to reorder · uncheck to skip · server falls through to next on failure",
      "用 ▲▼ 排序 · 取消勾选跳过 · 上一个失败自动落到下一个"
    );
    hint.style.cssText = "margin-top:8px;font:400 10px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.45);text-align:center;";
    card.appendChild(hint);
    return card;
  }

  async function open() {
    if (overlay && overlay.parentNode) return; // already open
    var data = await loadProviders();
    if (!data) {
      console.warn("[engine-picker] /api/llm/providers failed");
      return;
    }
    overlay = document.createElement("div");
    overlay.id = "cssos-engine-picker";
    overlay.style.cssText =
      "position:fixed;inset:0;z-index:2147483646;display:flex;align-items:center;justify-content:center;" +
      "background:rgba(0,8,6,0.78);backdrop-filter:blur(12px);" +
      "opacity:0;transition:opacity .18s ease;color:#daffee;" +
      "font:14px/1.4 -apple-system,system-ui,sans-serif;pointer-events:auto;";
    overlay.addEventListener("click", function (e) {
      if (e.target === overlay) close();
    });
    var card = document.createElement("div");
    card.style.cssText =
      "max-width:min(720px,94vw);max-height:88vh;overflow:auto;padding:24px 28px;" +
      "border-radius:18px;background:rgba(8,18,16,0.96);" +
      "border:1px solid rgba(0,245,160,0.35);box-shadow:0 30px 80px rgba(0,0,0,0.6);" +
      "display:flex;flex-direction:column;gap:16px;";
    var head = document.createElement("div");
    head.style.cssText = "display:flex;justify-content:space-between;align-items:center;gap:16px;";
    var title = document.createElement("div");
    title.textContent = tt("AI Engine Preferences", "AI 引擎偏好");
    title.style.cssText = "font:700 16px/1 -apple-system,system-ui,sans-serif;letter-spacing:.04em;";
    var close_ = document.createElement("button");
    close_.type = "button";
    close_.textContent = "×";
    close_.style.cssText = "background:transparent;border:0;color:rgba(218,255,238,0.7);cursor:pointer;font:400 22px/1 ui-monospace,monospace;padding:4px 10px;";
    close_.addEventListener("click", close);
    head.appendChild(title);
    head.appendChild(close_);
    card.appendChild(head);
    var blurb = document.createElement("div");
    blurb.textContent = tt(
      "Pick which AI engines cssOS uses for each capability. Keys live on the server; we never expose them. Disabled / un-configured options are dimmed.",
      "为每个能力指定 AI 引擎的优先顺序。Keys 永远只在服务器，不会暴露给前端。灰色项目表示未配置。"
    );
    blurb.style.cssText = "font:400 12px/1.5 -apple-system,system-ui,sans-serif;color:rgba(218,255,238,0.7);";
    card.appendChild(blurb);
    ["llm", "image", "music", "video", "tts"].forEach(function (kind) {
      var snapshot = data[kind];
      if (!snapshot) return;
      card.appendChild(buildKindCard(kind, snapshot));
    });
    overlay.appendChild(card);
    document.body.appendChild(overlay);
    requestAnimationFrame(function () { overlay.style.opacity = "1"; });
  }

  function close() {
    if (!overlay) return;
    overlay.style.opacity = "0";
    setTimeout(function () {
      if (overlay && overlay.parentNode) overlay.parentNode.removeChild(overlay);
      overlay = null;
    }, 200);
  }

  // ESC closes.
  window.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && overlay) { e.preventDefault(); close(); }
  });

  // Auto-bind a dock action for "engines" if present.
  function tryBindDock() {
    var btn = document.querySelector('.dock-item[data-action="engines"]');
    if (btn && !btn.dataset.cssosEngineBound) {
      btn.dataset.cssosEngineBound = "1";
      btn.addEventListener("click", function (e) {
        e.preventDefault(); e.stopPropagation();
        void open();
      });
    }
  }
  if (document.body) {
    new MutationObserver(tryBindDock).observe(document.body, { childList: true, subtree: true });
    tryBindDock();
  }

  globalThis.cssosEnginePicker = { open: open, close: close };
})();
