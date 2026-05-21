/* CSSOS_WAVE_270 20260521 — Jing: TikTok-style "watch first, create later"
 * conversion hook. While a viewer is enjoying an MV in the cinema feed,
 * a gentle "make one like this" call-to-action surfaces in the LAST N
 * seconds of playback (N ∈ {5,8,10,15,30}, default 10) — the moment the
 * viewer is most hooked. Tapping it jumps straight into creation; for a
 * guest it routes through the same creation surface (which gates auth).
 *
 * This is the 11K-views-on-TikTok → first-signup bridge: don't make the
 * user create cold, let curiosity build through watching, then ask.
 *
 * Once per work (dismiss or act = don't nag again for that work). Lead
 * seconds persisted in localStorage cssos_create_cta_lead_s.
 */
(function () {
  "use strict";
  if (globalThis.__cssosCreateCtaInstalled) return;
  globalThis.__cssosCreateCtaInstalled = true;

  var VALID_LEADS = [5, 8, 10, 15, 30];
  function leadSeconds() {
    try {
      var v = parseInt(localStorage.getItem("cssos_create_cta_lead_s") || "", 10);
      if (VALID_LEADS.indexOf(v) >= 0) return v;
    } catch (_e) {}
    return 10;
  }

  function tt(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      try { return globalThis.loginCopy(en, zh); } catch (_e) {}
    }
    var lang = (navigator.language || "en").toLowerCase();
    return (lang.indexOf("zh") === 0 && zh) ? zh : en;
  }

  function currentWorkId() {
    try { return String(globalThis.cssosCurrentWorkId && globalThis.cssosCurrentWorkId() || ""); }
    catch (_e) { return ""; }
  }

  var _shownForWork = {};   // workId → true (acted/dismissed this session)
  var _el = null;

  function dismiss(persist) {
    if (_el) { _el.style.opacity = "0"; _el.style.transform = "translateY(16px)"; }
    if (persist) { var w = currentWorkId(); if (w) _shownForWork[w] = true; }
  }

  var _pendingCreate = false;

  // CSSOS_WAVE_283 20260521 — Jing: 点 Create mine 不再跳走. 标记意图, 让
  // 用户【看完当前这首】, 当前媒体 ended 时【就在媒体框原地】启动 6 胶囊
  // 输出(invokeUniversalCreationEntry 在 watch 面板内跑完整 pipeline + 总
  // 进度条), 用户全程不离开、等着欣赏自己的新作品.
  function startInPlaceCreation() {
    _pendingCreate = false;
    try {
      if (typeof globalThis.invokeUniversalCreationEntry === "function") {
        void globalThis.invokeUniversalCreationEntry({ origin: "watch-cta", preferredTab: "mv" });
        return;
      }
    } catch (_e) {}
    // 兜底: 旧路径(仅在 universal entry 不可用时)
    try { globalThis.showCreationSurfaceModule?.("logo"); return; } catch (_e) {}
    try { document.getElementById("logo-button")?.click(); } catch (_e) {}
  }

  function openCreation() {
    if (_pendingCreate) return; // 已经在等了
    _pendingCreate = true;
    var w = currentWorkId(); if (w) _shownForWork[w] = true;
    // 把 CTA 切成"已确认 · 播完即开始"态(不跳走、不立即拆), 给用户明确反馈.
    try {
      if (_el) {
        var sub = _el.querySelector(".cssos-create-cta-sub");
        var go = _el.querySelector(".cssos-create-cta-go");
        var title = _el.querySelector(".cssos-create-cta-title");
        if (title) title.textContent = tt("On it ✨", "收到 ✨");
        if (sub) sub.textContent = tt("Finishing this one — your MV starts here when it ends.", "看完这首 —— 播完就在这里为你开始生成。");
        if (go) { go.textContent = tt("Starting after this song…", "本首播完即开始…"); go.disabled = true; go.style.opacity = "0.7"; }
      }
    } catch (_e) {}
    // 若当前媒体已近结束 / 已停, 立即开始(避免空等).
    try {
      var m = document.getElementById("watch-video") || document.getElementById("watch-audio-preview");
      if (!m || m.ended || (m.duration && isFinite(m.duration) && (m.duration - m.currentTime) <= 1.2)) {
        startInPlaceCreation();
      }
    } catch (_e) { startInPlaceCreation(); }
  }

  function ensureEl() {
    if (_el) return _el;
    var host = document.querySelector("#watch-panel .watch-screen") || document.getElementById("watch-panel");
    if (!host) return null;
    _el = document.createElement("div");
    _el.id = "cssos-create-cta";
    _el.className = "cssos-create-cta";
    _el.innerHTML =
      '<button type="button" class="cssos-create-cta-x" aria-label="dismiss">×</button>' +
      '<div class="cssos-create-cta-text">' +
        '<div class="cssos-create-cta-title">' +
          tt("Want an MV like this?", "想要一首这样的 MV 吗？") + '</div>' +
        '<div class="cssos-create-cta-sub">' +
          tt("Make your own in one tap — your story, your song.",
             "一键创作属于你的 —— 你的故事，你的歌。") + '</div>' +
      '</div>' +
      '<button type="button" class="cssos-create-cta-go">' +
        tt("Create mine ✨", "我也要做 ✨") + '</button>' +
      // CSSOS_WAVE_270 — inline lead-seconds picker (locality principle:
      // the setting lives ON the feature, not in a buried settings form).
      '<div class="cssos-create-cta-lead" title="' +
        tt("When this prompt appears before a song ends", "歌曲结束前多久弹出") + '">' +
        '<span class="cssos-create-cta-lead-label">⏱</span>' +
        VALID_LEADS.map(function (n) {
          return '<button type="button" class="cssos-create-cta-lead-opt" data-lead="' + n + '">' + n + 's</button>';
        }).join("") +
      '</div>';
    if (host.style && !host.style.position) host.style.position = "relative";
    host.appendChild(_el);
    _el.querySelector(".cssos-create-cta-x").addEventListener("click", function (e) {
      e.stopPropagation(); dismiss(true);
    });
    _el.querySelector(".cssos-create-cta-go").addEventListener("click", function (e) {
      e.stopPropagation(); openCreation();
    });
    // Lead-seconds picker: pick when the CTA appears (5/8/10/15/30).
    function paintLead() {
      var cur = leadSeconds();
      _el.querySelectorAll(".cssos-create-cta-lead-opt").forEach(function (b) {
        b.classList.toggle("is-active", Number(b.dataset.lead) === cur);
      });
    }
    _el.querySelectorAll(".cssos-create-cta-lead-opt").forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.stopPropagation();
        globalThis.cssosSetCreateCtaLead(Number(b.dataset.lead));
        paintLead();
      });
    });
    paintLead();
    return _el;
  }

  function show() {
    var el = ensureEl();
    if (!el) return;
    el.style.display = "flex";
    // force reflow then animate in
    void el.offsetWidth;
    el.style.opacity = "1";
    el.style.transform = "translateY(0)";
  }

  function onTimeUpdate(e) {
    var v = e && e.target;
    if (!v || !v.duration || !isFinite(v.duration) || v.duration < 8) return;
    var w = currentWorkId();
    if (w && _shownForWork[w]) return;
    var remaining = v.duration - v.currentTime;
    var lead = leadSeconds();
    if (remaining <= lead && remaining > 1.0) {
      show();
    }
  }

  // Reset per-work memory when a new work binds (so each new song in the
  // feed gets its own one-shot CTA).
  function onWorkBound() {
    if (_el) { _el.style.opacity = "0"; _el.style.transform = "translateY(16px)"; }
  }

  function attach() {
    var vids = ["watch-video", "watch-audio-preview"];
    vids.forEach(function (id) {
      var m = document.getElementById(id);
      if (m && !m.__cssosCreateCtaBound) {
        m.__cssosCreateCtaBound = true;
        m.addEventListener("timeupdate", onTimeUpdate, { passive: true });
        m.addEventListener("ended", function () {
          // CSSOS_WAVE_283 — 用户点过 Create mine 在等 → 本首播完, 原地开始输出.
          if (_pendingCreate) { startInPlaceCreation(); return; }
          dismiss(false);
        });
      }
    });
  }

  // Media elements may be (re)created; re-attach on an interval + on bind.
  attach();
  setInterval(attach, 4000);
  try {
    var origBind = globalThis.cssosBindToWorkId;
    if (typeof origBind === "function") {
      globalThis.cssosBindToWorkId = function () {
        try { onWorkBound(); } catch (_e) {}
        return origBind.apply(this, arguments);
      };
    }
  } catch (_e) {}

  // Expose a setter for the lead seconds (settings UI can call this).
  globalThis.cssosSetCreateCtaLead = function (n) {
    if (VALID_LEADS.indexOf(Number(n)) >= 0) {
      try { localStorage.setItem("cssos_create_cta_lead_s", String(n)); } catch (_e) {}
    }
  };
})();
