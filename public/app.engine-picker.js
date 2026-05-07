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

  /* Curated alternative models per provider — keeps the dropdown
   * useful without bloating the API. Each entry is "label" the user
   * sees; we send back the same string as the canonical model id. */
  var MODEL_OPTIONS = {
    // LLM
    "llm.openai":     ["gpt-4o-mini", "gpt-4o", "gpt-5", "o3-mini"],
    "llm.anthropic":  ["claude-haiku-4-5", "claude-sonnet-4-6", "claude-opus-4-7"],
    "llm.groq":       ["llama-3.3-70b-versatile", "llama-3.1-8b-instant", "mixtral-8x7b-32768"],
    "llm.cerebras":   ["llama-3.3-70b", "llama-3.1-8b", "llama3.1-405b"],
    "llm.gemini":     ["gemini-2.0-flash", "gemini-1.5-pro", "gemini-1.5-flash-8b"],
    "llm.together":   ["meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo", "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo", "Qwen/Qwen2.5-72B-Instruct-Turbo"],
    "llm.mistral":    ["mistral-large-latest", "mistral-medium-latest", "mistral-small-latest"],
    "llm.deepseek":   ["deepseek-chat", "deepseek-reasoner"],
    // Image
    "image.fal":         ["flux-schnell", "flux-dev", "flux-pro-1.1"],
    "image.together":    ["FLUX.1-schnell-Free", "FLUX.1-schnell", "FLUX.1-dev"],
    "image.replicate":   ["black-forest-labs/flux-schnell", "black-forest-labs/flux-dev", "black-forest-labs/flux-1.1-pro"],
    "image.huggingface": ["FLUX.1-schnell", "FLUX.1-dev"],
    "image.openai":      ["gpt-image-1", "dall-e-3"],
    // Music
    "music.suno":       ["suno-v4", "suno-v3.5"],
    "music.elevenlabs": ["music-v1"],
    "music.stability":  ["stable-audio-2", "stable-audio-1"],
    "music.mubert":     ["mubert-go"],
    // Video
    "video.fal":       ["fal-ai/luma-ray", "fal-ai/kling-video", "fal-ai/runway-gen3"],
    "video.replicate": ["wan-video/wan-2.2-i2v-a14b", "wan-video/wan-2.2-t2v-a14b", "tencent/hunyuan-video", "genmo/mochi-1"],
    "video.runway":    ["gen-3-alpha", "gen-3-alpha-turbo"],
    "video.luma":      ["ray-2", "ray-1.6"],
    "video.kling":     ["kling-v1", "kling-v1-5", "kling-v1-6"],
    // TTS
    "tts.elevenlabs": ["eleven_multilingual_v2", "eleven_turbo_v2_5", "eleven_flash_v2_5"],
    "tts.azure":      ["neural-tts"],
    "tts.openai":     ["tts-1", "tts-1-hd"],
    "tts.playht":     ["playht-2.0", "playht-1.0"],
  };

  /* Viewer role — set after /api/me resolves; admin sees "system
   * default" scope tag, regular users see "personal". */
  var viewerIsAdmin = false;

  function openModelDropdown(anchor, kind, provider, onPick) {
    // Close any other open one.
    var existing = document.getElementById("cssos-model-dropdown");
    if (existing && existing.parentNode) existing.parentNode.removeChild(existing);
    var options = MODEL_OPTIONS[kind + "." + provider.id] || [provider.default_model];
    var menu = document.createElement("div");
    menu.id = "cssos-model-dropdown";
    var rect = anchor.getBoundingClientRect();
    menu.style.cssText =
      "position:fixed;z-index:2147483647;" +
      "left:" + Math.max(8, Math.min(rect.left, window.innerWidth - 280)) + "px;" +
      "top:" + (rect.bottom + 6) + "px;" +
      "min-width:240px;max-width:320px;padding:6px;" +
      "border-radius:10px;background:rgba(8,18,16,0.96);" +
      "border:1px solid rgba(0,245,160,0.4);" +
      "box-shadow:0 18px 36px rgba(0,0,0,0.55);" +
      "display:flex;flex-direction:column;gap:2px;" +
      "font:500 12px/1.3 ui-monospace,monospace;color:#daffee;";
    var modelCookieKey = "cssos_" + kind + "_" + provider.id + "_model";
    var current = readCookie(modelCookieKey) || provider.default_model;
    var head = document.createElement("div");
    head.textContent = (viewerIsAdmin
      ? tt("Pick model — applies as system default", "选择模型 — 将设为系统默认")
      : tt("Pick model — personal preference", "选择模型 — 仅自己生效"));
    head.style.cssText = "padding:6px 10px 4px;font:600 10px/1.2 ui-monospace,monospace;color:rgba(0,245,160,0.85);letter-spacing:.06em;text-transform:uppercase;";
    menu.appendChild(head);
    options.forEach(function (m) {
      var item = document.createElement("button");
      item.type = "button";
      item.textContent = m;
      var isCurrent = m === current;
      item.style.cssText =
        "all:unset;cursor:pointer;padding:8px 12px;border-radius:6px;text-align:left;" +
        (isCurrent
          ? "background:rgba(0,245,160,0.22);color:#00f5a0;font-weight:700;"
          : "color:#daffee;") +
        "font:600 12px/1.3 ui-monospace,monospace;";
      item.addEventListener("mouseenter", function () {
        if (!isCurrent) item.style.background = "rgba(0,245,160,0.10)";
      });
      item.addEventListener("mouseleave", function () {
        if (!isCurrent) item.style.background = "";
      });
      item.addEventListener("click", function (e) {
        e.preventDefault();
        e.stopPropagation();
        onPick(m);
        if (menu.parentNode) menu.parentNode.removeChild(menu);
      });
      menu.appendChild(item);
    });
    var foot = document.createElement("div");
    foot.textContent = tt("Click outside to cancel", "点击外部取消");
    foot.style.cssText = "padding:4px 10px 6px;font:400 10px/1.2 ui-monospace,monospace;color:rgba(218,255,238,0.4);";
    menu.appendChild(foot);
    document.body.appendChild(menu);
    // Outside click closes.
    var off = function (e) {
      if (!menu.contains(e.target)) {
        if (menu.parentNode) menu.parentNode.removeChild(menu);
        document.removeEventListener("mousedown", off, true);
      }
    };
    setTimeout(function () { document.addEventListener("mousedown", off, true); }, 0);
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
      // Name + meta — hover to reveal ⚙, click ⚙ to pick model.
      var name = document.createElement("div");
      name.style.cssText = "flex:1;display:flex;flex-direction:column;gap:2px;cursor:pointer;";
      var primary = document.createElement("div");
      var modelCookieKey = "cssos_" + kind + "_" + p.id + "_model";
      var chosenModel = readCookie(modelCookieKey) || p.default_model;
      primary.style.cssText = "font:600 12px/1.2 ui-monospace,monospace;color:#daffee;display:flex;align-items:center;gap:6px;";
      var nameText = document.createElement("span");
      nameText.textContent = p.id + " · " + chosenModel;
      primary.appendChild(nameText);
      var gear = document.createElement("span");
      gear.textContent = "⚙";
      gear.style.cssText = "font-size:11px;color:rgba(0,245,160,0.7);opacity:0;transition:opacity .15s ease;";
      primary.appendChild(gear);
      var sub = document.createElement("div");
      var bits = [];
      if (p.free_tier) bits.push(tt("free", "免费档"));
      if (!p.configured) bits.push(tt("not configured", "未配置"));
      // Scope tag: admin's changes affect everyone, regular user's only themselves.
      bits.push(viewerIsAdmin
        ? tt("system default", "系统默认")
        : tt("personal", "仅自己"));
      sub.textContent = bits.join(" · ");
      sub.style.cssText = "font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.5);";
      name.appendChild(primary);
      name.appendChild(sub);
      // Hover → reveal gear.
      name.addEventListener("mouseenter", function () { gear.style.opacity = "1"; });
      name.addEventListener("mouseleave", function () { gear.style.opacity = "0"; });
      // Click anywhere on the name area → open model dropdown.
      name.addEventListener("click", function (e) {
        e.stopPropagation();
        openModelDropdown(name, kind, p, function (newModel) {
          chosenModel = newModel;
          nameText.textContent = p.id + " · " + chosenModel;
          // Always remember in cookie so the user sees their pick stick
          // (and the request-scoped path picks it up immediately).
          writeCookie(modelCookieKey, newModel);
          // Admin → also persist as system default for everyone else.
          if (viewerIsAdmin) {
            try {
              fetch("/api/admin/engine/default", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ kind: kind, provider: p.id, model: newModel }),
              }).catch(function () {});
            } catch (_e) {}
          }
        });
      });
      li.appendChild(name);
      list.appendChild(li);
    });
    card.appendChild(list);

    var hint = document.createElement("div");
    hint.textContent = tt(
      "▲▼ reorder · uncheck to skip · hover ⚙ to pick model · falls through on failure",
      "▲▼ 排序 · 取消勾选跳过 · 悬停 ⚙ 选模型 · 失败自动下一个"
    );
    hint.style.cssText = "margin-top:8px;font:400 10px/1.3 ui-monospace,monospace;color:rgba(218,255,238,0.45);text-align:center;";
    card.appendChild(hint);
    return card;
  }

  async function loadViewerRole() {
    try {
      var res = await fetch("/api/me", { credentials: "include", headers: { Accept: "application/json" } });
      var json = await res.json().catch(function () { return null; });
      var data = (json && (json.data || json)) || {};
      viewerIsAdmin = String(data.role || "").toLowerCase() === "admin";
    } catch (_e) { viewerIsAdmin = false; }
  }

  async function open() {
    if (overlay && overlay.parentNode) return; // already open
    // Resolve role + providers in parallel.
    var both = await Promise.all([loadProviders(), loadViewerRole()]);
    var data = both[0];
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
