/* CSSOS_PHASE2_MV_PIPELINE_PANEL 20260418 —
 * Frontend for the browser-orchestrated MV pipeline. Calls:
 *   /api/mv/cover, /api/mv/lyrics, /api/mv/music, /api/mv/video,
 *   /api/mv/subtitles, /api/mv/compose, /api/mv/commit
 * in sequence and renders progress + final cost breakdown.
 *
 * Design philosophy (from Jing, 2026-04-18):
 *   一切参数化 (everything parameterized)
 *   一切i18n全球化 (i18n everywhere)
 *   一切可扩展 (no hardcoded engine names — read from /api/mv/engines)
 *
 * Per-stage engine + version is resolved at run time via
 * `globalThis.cssmvEngines` (see app.mv-engines-catalog.js), which reads the
 * Rust-side catalog and persists the user's selection in localStorage.
 * The stage metadata table below stays in the file because it only contains
 * non-billing UI knobs (progress ETA, verb, localized fallback label).
 */

(function () {
  "use strict";

  const PANEL_ID = "mv-pipeline-panel";
  const DOCK_ACTION = "mv-pipeline";

  // CSSOS_PHASE2_MV_GUEST_GATE 20260419 ─────────────────────────────────
  // Per product requirement (Jing, 2026-04-19): MV Pipeline · 3rd-party
  // engines 面板 — guests (not logged in) must neither be able to see nor
  // operate it. We gate at three layers:
  //   1. ensureDockItem — the dock entry is created hidden for guests.
  //   2. openMvPipelinePanel — refuses to mount the panel for guests and
  //      routes them to the login panel instead.
  //   3. auth-state change — when the user signs out, any currently-open
  //      panel is hidden and the dock entry is re-hidden.
  function isMvPipelineAllowedForCurrentUser() {
    try {
      return !!(globalThis.authState && globalThis.authState.user);
    } catch (_) {
      return false;
    }
  }
  function routeGuestToLogin() {
    try {
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(
          (typeof globalThis.loginCopy === "function"
            ? globalThis.loginCopy("Please sign in first.", "请先登录。")
            : "Please sign in first.")
        );
      }
      if (typeof globalThis.openPanel === "function" && globalThis.loginPanel) {
        globalThis.openPanel(globalThis.loginPanel);
      }
    } catch (_) {}
  }
  function refreshMvPipelineGuestGate() {
    const allowed = isMvPipelineAllowedForCurrentUser();
    // Dock item
    const dockItem = document.querySelector('.dock-item[data-action="' + DOCK_ACTION + '"]');
    if (dockItem) {
      if (allowed) {
        dockItem.classList.remove("is-hidden");
      } else {
        dockItem.classList.add("is-hidden");
      }
    }
    // Existing panel — if guest, force-hide (do not destroy — state may be
    // restored after the user signs back in).
    if (!allowed) {
      const existing = document.getElementById(PANEL_ID);
      if (existing && !existing.classList.contains("hidden")) {
        existing.classList.add("hidden");
      }
    }
  }
  // Re-evaluate on auth-state change. Other panels in the app do their own
  // gating via updateDockVisibility + canOpenPanelById, but this panel is
  // dynamically created and not in the `dockByPanel` map, so we ride on the
  // same login/logout hooks that app.login-panel.js already fires.
  try {
    globalThis.addEventListener("cssos:auth-changed", refreshMvPipelineGuestGate);
  } catch (_) {}
  globalThis.refreshMvPipelineGuestGate = refreshMvPipelineGuestGate;

  // CSSOS_PHASE2_ZERO_INPUT 20260418 ────────────────────────────────
  // Zero-input creative seed bank. When a universal entry point (logo tap,
  // dock mic tap, dock play tap, Watch MV play, right-click 一键MV) triggers
  // the pipeline with no prompt/style, we synthesise a random seed locally so
  // nothing ever blocks on user input. Banks are parameterised (length +
  // contents), so a future `/api/creative/seed` endpoint or env-driven
  // override can swap the pool without touching this file.
  //
  // Principle (from Jing, 2026-04-18):
  //   缺啥补啥 + 零输入必须随机 + 一切参数化
  const ZERO_INPUT_PROMPT_BANK_EN = [
    "neon city skyline at dusk, lonely traveler",
    "cherry blossom storm over a glass tower",
    "astronaut dancing in a zero-gravity disco",
    "lantern festival on a forgotten river",
    "rainy alley, vinyl store, steam rising",
    "teen garage band, last song before dawn",
    "desert highway convertible, golden hour",
    "moonlit rooftop confession, city lights below",
    "cyber samurai meditating in rain",
    "hologram lovers in a drifting bullet train"
  ];
  const ZERO_INPUT_PROMPT_BANK_ZH = [
    "黄昏的霓虹都市，一个孤独的旅人",
    "玻璃塔上的樱花风暴",
    "零重力迪斯科里跳舞的宇航员",
    "被遗忘的河上的元宵灯会",
    "雨巷黑胶店，水汽升腾",
    "车库乐队天亮前的最后一首歌",
    "沙漠公路敞篷车，金色黄昏",
    "月光天台的告白，城市灯火在下方",
    "雨中冥想的赛博武士",
    "悬浮列车里的全息情侣"
  ];
  const ZERO_INPUT_STYLE_BANK = [
    "cinematic synthwave",
    "lo-fi dream pop",
    "epic orchestral hybrid",
    "ambient shoegaze",
    "retro city pop",
    "indie folk + strings",
    "atmospheric trap",
    "dream trance"
  ];
  // Cover prompt suffix — was hardcoded English-only inline. Now i18n +
  // overridable via env/catalog if we ever want a different visual style.
  const COVER_PROMPT_SUFFIX_EN = " — album cover, cinematic, high detail";
  const COVER_PROMPT_SUFFIX_ZH = " ——专辑封面，电影感，高细节";
  // Default video duration when music stage hasn't resolved yet. Video
  // providers typically charge by seconds so we keep the default conservative.
  const VIDEO_DEFAULT_DURATION_SECS = 8;
  // Default subtitle window when we have no audio duration yet (lyrics-only).
  const SUBTITLES_DEFAULT_DURATION_SECS = 60;
  // P2-24 Jing 2026-04-18: hard frontend ceiling on the /api/mv/video call.
  // The Runway backend has a 600s (10-min) overall_timeout default which is
  // far too long for a UI that the user is watching live. If the backend
  // hangs, we break out after 180s and fall back to music-only playback so
  // the user never sees the Watch panel stalled at "正在渲染视频 90%" forever.
  const VIDEO_TIMEOUT_MS = 180000;
  // Same idea for compose — kept at the P2-34 value.
  const COMPOSE_TIMEOUT_MS = 120000;

  function pickOne(list) {
    if (!Array.isArray(list) || list.length === 0) return "";
    if (typeof globalThis.pickRandom === "function") {
      const picked = globalThis.pickRandom(list, 1);
      return picked && picked[0] ? picked[0] : list[0];
    }
    return list[Math.floor(Math.random() * list.length)] || list[0];
  }

  // Synthesize a full zero-input seed (prompt + style) in the current locale.
  // Extracted so any caller can materialise a seed before hitting the pipeline.
  function synthesizeZeroInputSeed() {
    const zh = globalThis.currentLocale === "zh";
    return {
      prompt: pickOne(zh ? ZERO_INPUT_PROMPT_BANK_ZH : ZERO_INPUT_PROMPT_BANK_EN),
      style: pickOne(ZERO_INPUT_STYLE_BANK)
    };
  }
  globalThis.cssmvSynthesizeZeroInputSeed = synthesizeZeroInputSeed;

  // Stage UI metadata. `engine` / `version` are intentionally absent — they
  // are fetched from `cssmvEngines.getSelection(stage.id)` at runtime so the
  // user can reconfigure them in the advanced panel without code changes.
  // `etaSecs` is a UI-only hint for the asymptotic progress animation; actual
  // runtime depends on the selected engine.
  const STAGES = [
    { id: "cover",     etaSecs: 18, progressVerbKey: "mv.stage.cover.verb",     labelEn: "Cover art",  labelZh: "封面图",    verbEn: "Drawing cover",      verbZh: "正在绘制封面" },
    { id: "lyrics",    etaSecs: 8,  progressVerbKey: "mv.stage.lyrics.verb",    labelEn: "Lyrics",     labelZh: "歌词",      verbEn: "Writing lyrics",     verbZh: "正在生成歌词" },
    { id: "music",     etaSecs: 120, progressVerbKey: "mv.stage.music.verb",     labelEn: "Music",      labelZh: "音乐",      verbEn: "Composing music",    verbZh: "正在生成音乐" },
    { id: "video",     etaSecs: 45, progressVerbKey: "mv.stage.video.verb",     labelEn: "Video",      labelZh: "视频",      verbEn: "Rendering video",    verbZh: "正在渲染视频" },
    { id: "subtitles", etaSecs: 2,  progressVerbKey: "mv.stage.subtitles.verb", labelEn: "Subtitles",  labelZh: "字幕",      verbEn: "Timing subtitles",   verbZh: "正在对轴字幕" },
    { id: "compose",   etaSecs: 6,  progressVerbKey: "mv.stage.compose.verb",   labelEn: "MV compose", labelZh: "MV 合成",   verbEn: "Composing MV",       verbZh: "正在合成 MV" }
  ];

  // P2-62 — resumable pipeline. Each stage-row click resolves to an index in
  // this ordered list; `runAll({ resumeAt })` uses it to skip earlier stages
  // while preserving their prior outputs in `state`.
  const STAGE_ORDER = STAGES.map(function (s) { return s.id; });

  // Billing key mapping for the /api/mv/commit payload. Adding a new stage is
  // a one-line change in STAGES + this map; no other code path hardcodes
  // stage names.
  const COMMIT_COST_KEYS = {
    cover: "cover_cents",
    lyrics: "lyrics_cents",
    music: "music_cents",
    video: "video_cents",
    subtitles: "subtitles_cents",
    compose: "compose_cents"
  };

  const state = {
    prompt: "",
    style: "",
    lyrics: "",
    title: "",               // P2-31: resolved track title (known after music stage)
    coverUrl: null,
    audioUrl: null,
    videoUrl: null,
    videoDurSecs: 0, // #132 — used by Hybrid segment planner
    subtitlesSrt: null,
    mvUrl: null,
    duration: 0,
    costs: {},
    engines: {}, // per-stage { engine, version, provider_model?, cost_cents, input_tokens?, output_tokens? }
    running: false,
    stageState: {},
    progress: {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  // CSSOS_PHASE2_TITLE_BAR_LIVE_PCT 20260426 #128 — Jing
  //
  // "请把…百分比为实时，正确的百分比数据（请复用My pipeline面板的代码）"
  //
  // Single-source-of-truth accessor. Watch panel's title-bar formatter
  // (app.watch-ui.js) calls this every update and gets the active stage +
  // its real-time progress directly from the IIFE-private `state` object.
  // No event bus, no global mutation — just a function the title writer
  // pulls when it needs to know "where is the pipeline RIGHT NOW".
  //
  // Returns:
  //   null                                — no run in progress, no done stages
  //   {stageId, label, pct, finished, hasError} — active or last-touched stage
  function pipelineActiveStage() {
    if (!state || !state.stageState) return null;
    // Priority 1: any stage currently running. Use the latest in STAGE_ORDER
    // so user sees "Compose 60%" instead of "Cover 100%" when both are alive.
    for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
      const id = STAGE_ORDER[i];
      if (state.stageState[id] === "running") {
        const p = state.progress[id] || {};
        const rawPct = typeof p.pct === "number" ? p.pct : 0;
        return {
          stageId: id,
          label: stageLabel(id),
          pct: Math.max(0, Math.min(100, Math.round(rawPct))),
          finished: false,
          hasError: false
        };
      }
    }
    // Priority 2: any stage in error — surface that, not a stale "done" tail.
    for (let i = STAGE_ORDER.length - 1; i >= 0; i--) {
      const id = STAGE_ORDER[i];
      if (state.stageState[id] === "error") {
        return {
          stageId: id,
          label: stageLabel(id),
          pct: 0,
          finished: false,
          hasError: true
        };
      }
    }
    // Priority 3: the last completed stage.
    let lastDone = null;
    for (let i = 0; i < STAGE_ORDER.length; i++) {
      const id = STAGE_ORDER[i];
      if (state.stageState[id] === "done") lastDone = id;
    }
    if (lastDone) {
      return {
        stageId: lastDone,
        label: stageLabel(lastDone),
        pct: 100,
        finished: true,
        hasError: false
      };
    }
    return null;
  }
  if (globalThis) globalThis.cssmvPipelineActiveStage = pipelineActiveStage;

  // ───────────────── i18n fallback ─────────────────
  // All UI strings in this panel must go through `copy(en, zh)` so the
  // language switcher picks them up. If a host-app `loginCopy` helper is
  // available we defer to it so both stay in sync.
  function copy(en, zh) {
    if (typeof globalThis.loginCopy === "function") {
      return globalThis.loginCopy(en, zh);
    }
    return (globalThis.currentLocale === "zh") ? zh : en;
  }

  function stageLabel(stage) {
    // Prefer the engines catalog's i18n key so a single source of truth wins.
    if (globalThis.cssmvEngines?.getStage) {
      const catStage = globalThis.cssmvEngines.getStage(stage.id);
      if (catStage && typeof globalThis.cssmvEngines.resolveStageI18nLabel === "function") {
        const lbl = globalThis.cssmvEngines.resolveStageI18nLabel(catStage);
        if (lbl) return lbl;
      }
    }
    return copy(stage.labelEn, stage.labelZh);
  }

  function stageVerb(stage) {
    return copy(stage.verbEn, stage.verbZh);
  }

  function selectedEngine(stageId) {
    if (globalThis.cssmvEngines?.getSelection) {
      try {
        return globalThis.cssmvEngines.getSelection(stageId) || { engine: null, version: null };
      } catch (_err) {
        /* ignore */
      }
    }
    return { engine: null, version: null };
  }

  // ─────────────────────────────────────────────────────────────────────────
  // CSSOS_PHASE2_LITE_SEGMENT_PLANNER 20260426 #47 — Jing
  //
  // Tier-aware segment planner. Given the cover URL + audio duration, builds
  // a `segments[]` array for /api/mv/compose so the backend's xfade chain
  // (mv_compose.rs::compose_xfade_chain, #126) renders a smooth Ken-Burns
  // slideshow instead of a single-clip mux.
  //
  // Lite tier:
  //   - Pure slideshow over the cover image (zero AI-video cost).
  //   - We aim for ~7s per slide. Slide count N is clamped [4, 12] so we
  //     don't spawn 30 ffmpeg subprocesses for very long songs and don't
  //     leave a 30s song with only 2 slides.
  //   - Each slide cycles through a different zoompan effect (zoom_in,
  //     pan_right, zoom_out, pan_left, pan_up, pan_down) so the visual
  //     never feels static even on a single source image.
  //   - Slide duration is solved so total runtime after xfade overlap
  //     equals the audio duration:
  //         total = N * each - (N-1) * t   →   each = (total + (N-1)*t) / N
  //
  // Hybrid / Cinematic tiers (#132):
  //   - When an AI video clip is available, splice it into the timeline as
  //     a HOOK segment (~40 % into the song, the typical chorus position).
  //     Ken Burns slides over the cover image fill the remainder. Total
  //     runtime after xfade overlap matches the audio duration so the
  //     Runway clip is no longer wasted.
  //   - When the AI video is missing (stage failed or cinematic ratio asks
  //     for none), fall through to the Lite-style all-Ken-Burns slideshow.
  //
  // Returns: { segments: [...] } | null  (null = caller should use video_url)
  function planComposeSegments(opts) {
    const tierId = String(opts.tierId || "").toLowerCase();
    const coverUrl = opts.coverUrl;
    const totalSecs = Number(opts.durationSecs) > 1
      ? Number(opts.durationSecs)
      : 60;
    const aiVideoUrl = String(opts.aiVideoUrl || "").trim();
    const aiVideoDurRaw = Number(opts.aiVideoDurSecs);
    if (!coverUrl) {
      return null;
    }
    const t = 1.2; // xfade duration; matches DEFAULT_XFADE_DURATION_SECS in mv_compose.rs.
    const effects = [
      "zoom_in", "pan_right", "zoom_out",
      "pan_left", "pan_up",    "pan_down"
    ];

    // ── Hybrid / Cinematic path: mix AI video + Ken Burns ─────────────────
    if ((tierId === "hybrid" || tierId === "cinematic") && aiVideoUrl) {
      // Clamp AI video duration. Runway gen4_turbo gives 5 or 10s; if the
      // upstream fib'd, clamp to a sane band so the math doesn't blow up.
      const aiDur = Math.max(3, Math.min(15, aiVideoDurRaw > 0 ? aiVideoDurRaw : 10));
      // Reserve aiDur for the AI clip; the rest is Ken Burns. Aim for
      // ~12s per slide so the song breathes; minimum 4 slides so the
      // hook actually feels like a hook (not "1 KB → AI → 1 KB").
      const remainingForKB = Math.max(0, totalSecs - aiDur);
      let kbCount = Math.round(remainingForKB / 12);
      if (kbCount < 4) kbCount = 4;
      if (kbCount > 10) kbCount = 10;
      const N = kbCount + 1; // +1 for the AI clip
      // total = sum(d) - (N-1)*t  →  sum = total + (N-1)*t
      // sum = aiDur + kbCount * kbEach  →  kbEach = (sum - aiDur) / kbCount
      const sum = totalSecs + (N - 1) * t;
      const kbEach = (sum - aiDur) / kbCount;
      const safeT = Math.min(t, Math.max(0.4, Math.min(kbEach, aiDur) * 0.4));
      // Place the AI clip at the hook: ~40% through the slide stack.
      // For kbCount=6 that's index 2 (3rd slide → AI → 4 more slides).
      const aiInsertIdx = Math.max(1, Math.min(kbCount - 1, Math.round(kbCount * 0.4)));
      const segments = [];
      for (let i = 0; i < kbCount; i++) {
        if (i === aiInsertIdx) {
          segments.push({
            kind: "ai_video",
            source_url: aiVideoUrl,
            duration_secs: Number(aiDur.toFixed(3)),
            transition: "fade",
            transition_duration_secs: Number(safeT.toFixed(3))
          });
        }
        segments.push({
          kind: "kenburns_image",
          source_url: coverUrl,
          duration_secs: Number(kbEach.toFixed(3)),
          effect: effects[i % effects.length],
          transition: "fade",
          transition_duration_secs: Number(safeT.toFixed(3))
        });
      }
      // Edge case: if kbCount === aiInsertIdx the loop above never reached
      // the insertion index (impossible with the clamps above, but be safe).
      if (segments.length === kbCount) {
        segments.push({
          kind: "ai_video",
          source_url: aiVideoUrl,
          duration_secs: Number(aiDur.toFixed(3)),
          transition: "fade",
          transition_duration_secs: Number(safeT.toFixed(3))
        });
      }
      return {
        segments: segments,
        segmentCount: segments.length,
        kbCount: kbCount,
        aiClipSecs: aiDur,
        kbEachSecs: kbEach,
        transitionSecs: safeT,
        plan: "hybrid_mixer"
      };
    }

    // ── Lite path: pure Ken Burns slideshow ──────────────────────────────
    if (tierId !== "lite" && tierId !== "hybrid" && tierId !== "cinematic") {
      return null;
    }
    // Hybrid / Cinematic with no AI video URL falls through here too —
    // graceful degradation when the video stage failed or wasn't run.
    const targetEachSecs = 7;
    const minSegments = 4;
    const maxSegments = 12;
    let N = Math.round(totalSecs / targetEachSecs);
    if (N < minSegments) N = minSegments;
    if (N > maxSegments) N = maxSegments;
    // Solve so concatenated runtime (after xfade overlaps) equals totalSecs.
    const each = (totalSecs + (N - 1) * t) / N;
    const safeT = Math.min(t, Math.max(0.4, each * 0.4));
    const segments = [];
    for (let i = 0; i < N; i++) {
      segments.push({
        kind: "kenburns_image",
        source_url: coverUrl,
        duration_secs: Number(each.toFixed(3)),
        effect: effects[i % effects.length],
        transition: "fade",
        transition_duration_secs: Number(safeT.toFixed(3))
      });
    }
    return {
      segments: segments,
      segmentCount: N,
      eachSecs: each,
      transitionSecs: safeT,
      plan: "lite_slideshow"
    };
  }
  // expose for debugging/tests
  if (globalThis) globalThis.cssmvPlanComposeSegments = planComposeSegments;

  function ensurePanel() {
    let panel = document.getElementById(PANEL_ID);
    if (panel) return panel;
    panel = document.createElement("section");
    panel.className = "panel flow hidden";
    panel.id = PANEL_ID;
    panel.setAttribute("data-variant", "mv-pipeline");
    panel.innerHTML = markup();
    const anchor = document.getElementById("cssmv-panel") || document.body;
    anchor.insertAdjacentElement("afterend", panel);
    wire(panel);
    // Warm the engines catalog so badge labels populate quickly.
    if (globalThis.cssmvEngines?.fetchCatalog) {
      void globalThis.cssmvEngines.fetchCatalog(false).then(() => {
        refreshStageBadges();
      });
    }
    return panel;
  }

  function markup() {
    const stagesHtml = STAGES.map(function (s) {
      return (
        '<div class="mvp-stage" data-stage="' + s.id + '">' +
          '<div class="mvp-stage-head">' +
            '<span class="mvp-stage-dot" data-state="idle"></span>' +
            '<span class="mvp-stage-label">' + escapeHtml(stageLabel(s)) + '</span>' +
            '<span class="mvp-stage-engine" data-engine-for="' + s.id + '"></span>' +
            '<span class="mvp-stage-cost" data-cost-for="' + s.id + '">—</span>' +
          '</div>' +
          '<div class="mvp-stage-progress" data-progress-for="' + s.id + '" aria-hidden="true">' +
            '<div class="mvp-stage-progress-track">' +
              '<div class="mvp-stage-progress-fill" data-progress-fill-for="' + s.id + '"></div>' +
            '</div>' +
            '<div class="mvp-stage-progress-label" data-progress-label-for="' + s.id + '"></div>' +
          '</div>' +
          '<div class="mvp-stage-detail" data-detail-for="' + s.id + '"></div>' +
        '</div>'
      );
    }).join("");
    const runLabel = copy("Start pipeline", "开始生成");
    const saveLabel = copy("Save as work", "保存为作品");
    const promptLabel = copy("Prompt / theme", "Prompt / 主题");
    const styleLabel = copy("Style", "风格");
    const lyricsLabel = copy("Lyrics (optional)", "歌词（可选）");
    const promptPlaceholder = copy(
      "e.g. A dreamy synth-pop ballad about flying to the moon",
      "例如：一首关于飞向月球的梦幻合成流行乐"
    );
    const lyricsPlaceholder = copy(
      "Leave blank to let the selected LLM write lyrics",
      "留空会用你在高级设置里选的 LLM 自动生成歌词"
    );
    const stylePlaceholder = copy("synth-pop, cinematic, warm", "合成流行、电影感、温暖");
    const paneTitle = copy("MV Pipeline · 3rd-party engines", "MV Pipeline · 第三方引擎");
    return (
      '<div class="panel-bar">' +
        '<div class="panel-icon">🎞️</div>' +
        '<div class="panel-title">' + escapeHtml(paneTitle) + '</div>' +
        '<div class="panel-actions">' +
          '<button class="icon-btn" aria-label="minimize">—</button>' +
          '<button class="icon-btn" aria-label="lock">⛶</button>' +
          '<button class="icon-btn" aria-label="close">×</button>' +
        '</div>' +
      '</div>' +
      '<div class="panel-body">' +
        '<div class="mvp-inputs">' +
          '<label>' + escapeHtml(promptLabel) + '</label>' +
          '<textarea id="mvp-prompt" rows="2" placeholder="' + escapeHtml(promptPlaceholder) + '"></textarea>' +
          '<label>' + escapeHtml(styleLabel) + '</label>' +
          '<input id="mvp-style" type="text" placeholder="' + escapeHtml(stylePlaceholder) + '" />' +
          '<label>' + escapeHtml(lyricsLabel) + '</label>' +
          '<textarea id="mvp-lyrics" rows="3" placeholder="' + escapeHtml(lyricsPlaceholder) + '"></textarea>' +
          renderAspectRatioControls() +
        '</div>' +
        '<div class="mvp-actions">' +
          '<button id="mvp-run" class="cta">' + escapeHtml(runLabel) + '</button>' +
          '<button id="mvp-save" class="cta tiny" disabled>' + escapeHtml(saveLabel) + '</button>' +
          // CSSOS_PHASE2_MV_TIER_LABEL 20260419 — 常驻 cost label next to
          // the Generate button. Populated by refreshTierCostLabel() once
          // /api/mv/tiers resolves; starts blank so there's no flash of
          // placeholder text. Click to cycle tiers as a v0 picker.
          '<span id="mvp-tier-label" class="mvp-tier-label" role="button" tabindex="0" data-tier-id=""></span>' +
        '</div>' +
        '<div class="mvp-stages">' + stagesHtml + '</div>' +
        '<div class="mvp-summary" id="mvp-summary"></div>' +
      '</div>'
    );
  }

  function escapeHtml(s) {
    if (typeof globalThis.escapeHtml === "function" && globalThis.escapeHtml !== escapeHtml) {
      return globalThis.escapeHtml(s);
    }
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // P2-51: output aspect-ratio selector rendered inside the mv-inputs block.
  // Reads from / writes to the shared creationState + fires applyAspectRatioCssVar
  // so the Watch preview frame stays in sync with the current spec even before
  // the user hits Run.
  function renderAspectRatioControls() {
    const presets = globalThis.ASPECT_PRESETS || {};
    const order = globalThis.ASPECT_PRESET_ORDER || Object.keys(presets);
    const currentKey = (globalThis.creationState && globalThis.creationState.aspectRatio) || "16:9";
    const lang = (globalThis.currentLocale === "zh") ? "zh" : "en";
    const headline = copy("Output format", "输出格式");
    const customW = (globalThis.creationState && globalThis.creationState.customWidth) || "";
    const customH = (globalThis.creationState && globalThis.creationState.customHeight) || "";
    const widthPh = copy("Width px", "宽 px");
    const heightPh = copy("Height px", "高 px");
    let chips = "";
    order.forEach(function (key) {
      const p = presets[key];
      if (!p) return;
      const label = (p.label && (p.label[lang] || p.label.en)) || key;
      const pressed = (key === currentKey) ? "true" : "false";
      chips += '<button type="button" class="mvp-aspect-chip" '
        + 'data-ar="' + escapeHtml(key) + '" '
        + 'aria-pressed="' + pressed + '">'
        + escapeHtml(label) + '</button>';
    });
    const customHidden = (currentKey === "custom") ? "" : " hidden";
    return (
      '<label>' + escapeHtml(headline) + '</label>' +
      '<div class="mvp-aspect-row" id="mvp-aspect-row" role="group" aria-label="' + escapeHtml(headline) + '">' +
        chips +
      '</div>' +
      '<div class="mvp-aspect-custom" id="mvp-aspect-custom"' + customHidden + '>' +
        '<input id="mvp-aspect-w" type="number" min="64" max="8192" step="1" '
          + 'placeholder="' + escapeHtml(widthPh) + '" value="' + escapeHtml(String(customW)) + '" />' +
        '<span class="mvp-aspect-x" aria-hidden="true">×</span>' +
        '<input id="mvp-aspect-h" type="number" min="64" max="8192" step="1" '
          + 'placeholder="' + escapeHtml(heightPh) + '" value="' + escapeHtml(String(customH)) + '" />' +
      '</div>' +
      '<div class="mvp-aspect-caption" id="mvp-aspect-caption"></div>'
    );
  }

  function wireAspectRatioControls(panel) {
    const row = panel.querySelector("#mvp-aspect-row");
    const custom = panel.querySelector("#mvp-aspect-custom");
    const caption = panel.querySelector("#mvp-aspect-caption");
    const wIn = panel.querySelector("#mvp-aspect-w");
    const hIn = panel.querySelector("#mvp-aspect-h");
    if (!row || !custom || !caption || !wIn || !hIn) return;

    function refreshCaption() {
      const spec = (typeof globalThis.resolveCreationAspectRatio === "function")
        ? globalThis.resolveCreationAspectRatio()
        : null;
      if (!spec) { caption.textContent = ""; caption.removeAttribute("data-warn"); return; }
      const dims = spec.width + " × " + spec.height;
      const orientTxt = (globalThis.currentLocale === "zh")
        ? ({ landscape: "横向", portrait: "竖向", square: "方形" }[spec.orientation] || "")
        : spec.orientation;
      const base = dims + " · " + spec.label + (orientTxt ? " · " + orientTxt : "");
      caption.textContent = spec.warning ? base + " ⚠ " + spec.warning : base;
      if (spec.warning) caption.setAttribute("data-warn", "true");
      else caption.removeAttribute("data-warn");
    }

    function applyChange() {
      if (typeof globalThis.applyAspectRatioCssVar === "function") {
        try { globalThis.applyAspectRatioCssVar(); } catch (_e) { /* non-fatal */ }
      }
      refreshCaption();
    }

    row.addEventListener("click", function (ev) {
      const btn = ev.target && ev.target.closest ? ev.target.closest(".mvp-aspect-chip") : null;
      if (!btn || !row.contains(btn)) return;
      const key = btn.getAttribute("data-ar") || "16:9";
      if (globalThis.creationState) globalThis.creationState.aspectRatio = key;
      if (typeof globalThis.markCreationFieldTouched === "function") {
        globalThis.markCreationFieldTouched("aspectRatio");
      }
      // Flip aria-pressed across siblings
      Array.prototype.forEach.call(row.querySelectorAll(".mvp-aspect-chip"), function (el) {
        el.setAttribute("aria-pressed", el === btn ? "true" : "false");
      });
      if (key === "custom") custom.hidden = false;
      else custom.hidden = true;
      applyChange();
    });

    function onCustomInput() {
      const wVal = Number(wIn.value);
      const hVal = Number(hIn.value);
      if (globalThis.creationState) {
        globalThis.creationState.customWidth = Number.isFinite(wVal) && wVal > 0 ? wVal : null;
        globalThis.creationState.customHeight = Number.isFinite(hVal) && hVal > 0 ? hVal : null;
      }
      if (typeof globalThis.markCreationFieldTouched === "function") {
        globalThis.markCreationFieldTouched("customWidth");
        globalThis.markCreationFieldTouched("customHeight");
      }
      applyChange();
    }
    wIn.addEventListener("input", onCustomInput);
    hIn.addEventListener("input", onCustomInput);

    // Initial caption + CSS var push.
    applyChange();
  }

  function wire(panel) {
    panel.querySelector("#mvp-run").addEventListener("click", runAll);
    panel.querySelector("#mvp-save").addEventListener("click", saveAsWork);
    wireAspectRatioControls(panel);
    // CSSOS_PHASE2_MV_TIER_LABEL 20260419 — wire the tier cost label. Click
    // or Enter/Space cycles through Lite/Hybrid/Cinematic (v0 picker; the
    // full slider lands in task #47). Refresh once on mount so the label
    // paints the default tier even before cssmv:tiers-ready fires.
    const tierLabel = panel.querySelector("#mvp-tier-label");
    if (tierLabel) {
      tierLabel.addEventListener("click", cycleTier);
      tierLabel.addEventListener("keydown", function (ev) {
        if (ev.key === "Enter" || ev.key === " ") {
          ev.preventDefault();
          cycleTier();
        }
      });
    }
    refreshTierCostLabel();
    // Kick off the tiers fetch (idempotent — module also warms on load).
    try {
      if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.fetchCatalog === "function") {
        void globalThis.cssmvTiers.fetchCatalog(false).then(refreshTierCostLabel);
      }
    } catch (_err) { /* ignore */ }
    // P2-62 — click a stage row to resume from that stage. Only fires when
    // the pipeline is idle AND the clicked stage is in an error/idle state
    // (so clicking a "done" or "running" row doesn't silently rerun work).
    panel.addEventListener("click", function (ev) {
      const row = ev.target.closest ? ev.target.closest(".mvp-stage") : null;
      if (!row || !row.dataset || !row.dataset.stage) return;
      if (state.running) return;
      const stageId = row.dataset.stage;
      if (STAGE_ORDER.indexOf(stageId) < 0) return;
      const curState = state.stageState[stageId];
      if (curState !== "error" && curState !== "idle") return;
      runAll({ resumeAt: stageId });
    });
  }

  function refreshStageBadges() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    STAGES.forEach(function (s) {
      const el = panel.querySelector('[data-engine-for="' + s.id + '"]');
      if (!el) return;
      const sel = selectedEngine(s.id);
      if (sel.engine && sel.version) {
        el.textContent = sel.engine + "/" + sel.version;
      } else {
        el.textContent = "";
      }
    });
  }

  // CSSOS_PHASE2_MV_TIER_LABEL 20260419 —
  // Persistent tier-cost label next to the Generate button. Rendered here
  // rather than hardcoded because the tier list + prices are authoritative
  // on the backend (see billing_matrix.rs::mv_tiers) and can be re-tuned by
  // ops via env vars without a frontend redeploy.
  function refreshTierCostLabel() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const el = panel.querySelector("#mvp-tier-label");
    if (!el) return;
    const api = globalThis.cssmvTiers;
    if (!api || typeof api.currentTier !== "function") {
      // Module hasn't loaded yet — leave the label blank and retry on the
      // "cssmv:tiers-ready" event fired by app.mv-tiers-catalog.js.
      el.textContent = "";
      el.setAttribute("data-tier-id", "");
      return;
    }
    const tier = api.currentTier();
    if (!tier) {
      el.textContent = "";
      el.setAttribute("data-tier-id", "");
      return;
    }
    const formatted = api.formatCostLabel(tier);
    el.textContent = formatted.text || "";
    if (formatted.title) el.setAttribute("title", formatted.title);
    el.setAttribute("data-tier-id", formatted.tierId || "");
    // Expose the whole breakdown as data- attrs so a future tooltip / modal
    // (the upcoming new-user picker) can read it without re-fetching.
    try {
      const breakdown = tier.cost_breakdown || {};
      const pricing = tier.pricing || {};
      el.setAttribute("data-gen-cost-usd", String(breakdown.total_usd || 0));
      el.setAttribute("data-creator-credit-usd", String(pricing.creator_credit_usd || 0));
      el.setAttribute("data-suggested-buyout-usd", String(pricing.suggested_buyout_usd || 0));
      el.setAttribute("data-suggested-listen-usd", String(pricing.suggested_listen_usd || 0));
      el.setAttribute("data-breakeven-listens", String(pricing.breakeven_listens || 0));
      el.setAttribute("data-ai-video-ratio-pct", String(tier.ai_video_ratio_pct || 0));
    } catch (_err) { /* non-fatal */ }
  }

  // Click the cost label to cycle Lite → Hybrid → Cinematic → Lite. This is
  // a v0 tier picker; the full segment-planner slider lands in task #47.
  // Keyboard access: Enter / Space on the focused label also cycles.
  function cycleTier() {
    const api = globalThis.cssmvTiers;
    if (!api || typeof api.getTiers !== "function") return;
    const tiers = api.getTiers();
    if (!tiers || tiers.length === 0) return;
    const currentId = api.currentTierId();
    let idx = 0;
    for (let i = 0; i < tiers.length; i++) {
      if (String(tiers[i].id || "").toLowerCase() === String(currentId).toLowerCase()) {
        idx = i;
        break;
      }
    }
    const next = tiers[(idx + 1) % tiers.length];
    if (next && next.id) api.setTier(next.id);
  }

  // CSSOS_PHASE2_6STAGE_PASSTHROUGH 20260419 — the Watch panel's border chase
  // now owns 6 arc slots (cover/lyrics/music/video/subtitles/compose), so
  // every pipeline stage id flows through untouched. Previously we collapsed
  // subtitles→video and compose→mv because the old Watch bars only had 5
  // slots; that's no longer the case.
  function watchBarKeyForStage(id) {
    return id;
  }

  function setStage(id, newState, detail, costCents) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    state.stageState[id] = newState;
    // Drive Watch panel border chase — 6 slot arcs, one per pipeline stage
    try {
      const barKey = watchBarKeyForStage(id);
      if (newState === "running" && typeof globalThis.cssmvStageBarsSetProgress === "function") {
        globalThis.cssmvStageBarsSetProgress(barKey, 0);
      } else if (newState === "done" && typeof globalThis.cssmvStageBarsSetDone === "function") {
        globalThis.cssmvStageBarsSetDone(barKey);
      }
    } catch (_err) { /* non-fatal */ }
    const dot = panel.querySelector(
      '.mvp-stage[data-stage="' + id + '"] .mvp-stage-dot'
    );
    if (dot) dot.setAttribute("data-state", newState);
    if (detail !== undefined) {
      const el = panel.querySelector('[data-detail-for="' + id + '"]');
      if (el) el.textContent = detail || "";
    }
    if (costCents !== undefined) {
      state.costs[id] = costCents;
      const el = panel.querySelector('[data-cost-for="' + id + '"]');
      if (el) el.textContent = formatUsd(costCents);
    }
    if (newState === "running") startStageProgress(id);
    else if (newState === "done") completeStageProgress(id);
    else if (newState === "error") failStageProgress(id);
    else if (newState === "idle") resetStageProgress(id);
    renderSummary();
  }

  function stageDef(id) {
    for (let i = 0; i < STAGES.length; i++) {
      if (STAGES[i].id === id) return STAGES[i];
    }
    return null;
  }

  function startStageProgress(id) {
    const def = stageDef(id);
    if (!def) return;
    stopStageProgress(id);
    state.progress[id] = {
      startedAt: Date.now(),
      etaSecs: Math.max(1, def.etaSecs || 10),
      pct: 0,
      verb: stageVerb(def),
      timer: null,
      finished: false
    };
    showProgress(id, true, "error-state", false);
    tickStageProgress(id);
    state.progress[id].timer = setInterval(function () {
      tickStageProgress(id);
    }, 250);
  }

  function tickStageProgress(id) {
    const p = state.progress[id];
    if (!p || p.finished) return;
    const tSecs = (Date.now() - p.startedAt) / 1000;
    // CSSOS_PHASE2_PROGRESS_CURVE 20260425 #119 — Jing
    // Old curve hit 95 % asymptote and parked there for the entire
    // long tail of the job, so users saw "95 % then dies" even when
    // the engine was still working. New curve:
    //   • Approach 95 % over `etaSecs` (1 - 1/e ≈ 63 %, then 86 %, …)
    //   • From 95 % onward, creep slowly toward 99.5 % over the next
    //     ~5 × etaSecs so the user can see the bar IS still moving
    //     and the engine isn't stuck. Hard cap at 99.5 % so we don't
    //     jump to 100 % before the response arrives.
    let eased;
    if (tSecs <= p.etaSecs) {
      eased = 95 * (1 - Math.exp(-tSecs / p.etaSecs));
    } else {
      const extraT = tSecs - p.etaSecs;
      // Slowly close the remaining 4.5 % over 5 × etaSecs.
      eased = 95 + 4.5 * (1 - Math.exp(-extraT / (p.etaSecs * 5)));
    }
    p.pct = Math.min(99.5, Math.max(p.pct, eased));
    renderProgress(id);
    // Mirror pipeline progress into the Watch panel's 6 border-chase slots.
    try {
      if (typeof globalThis.cssmvStageBarsSetProgress === "function") {
        globalThis.cssmvStageBarsSetProgress(watchBarKeyForStage(id), p.pct);
      }
    } catch (_err) { /* non-fatal */ }
  }

  function completeStageProgress(id) {
    const p = state.progress[id];
    if (!p) {
      showProgress(id, false);
      return;
    }
    stopStageProgress(id);
    p.pct = 100;
    p.finished = true;
    renderProgress(id);
    setTimeout(function () {
      if (state.stageState[id] === "done") showProgress(id, false);
    }, 500);
  }

  function failStageProgress(id) {
    const p = state.progress[id];
    stopStageProgress(id);
    if (p) {
      p.finished = true;
      renderProgress(id);
    }
    showProgress(id, true, "error-state", true);
  }

  function resetStageProgress(id) {
    stopStageProgress(id);
    state.progress[id] = null;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const fill = panel.querySelector('[data-progress-fill-for="' + id + '"]');
    if (fill) fill.style.width = "0%";
    const label = panel.querySelector('[data-progress-label-for="' + id + '"]');
    if (label) label.textContent = "";
    showProgress(id, false);
  }

  function stopStageProgress(id) {
    const p = state.progress[id];
    if (p && p.timer) {
      clearInterval(p.timer);
      p.timer = null;
    }
  }

  function renderProgress(id) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const p = state.progress[id];
    if (!p) return;
    const fill = panel.querySelector('[data-progress-fill-for="' + id + '"]');
    if (fill) fill.style.width = Math.round(p.pct) + "%";
    const label = panel.querySelector('[data-progress-label-for="' + id + '"]');
    if (label) label.textContent = p.verb + "…" + Math.round(p.pct) + "%";
  }

  function showProgress(id, visible, modClass, modOn) {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const el = panel.querySelector('[data-progress-for="' + id + '"]');
    if (!el) return;
    el.classList.toggle("visible", !!visible);
    if (modClass) el.classList.toggle(modClass, !!modOn);
  }

  function renderSummary() {
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const box = panel.querySelector("#mvp-summary");
    if (!box) return;
    const total = Object.values(state.costs).reduce(function (a, b) {
      return a + (b || 0);
    }, 0);
    if (!total && !state.mvUrl) {
      box.innerHTML = "";
      return;
    }
    const costLabel = copy(
      "3rd-party engine cost",
      "第三方引擎成本"
    );
    let html = '<div class="mvp-summary-head">' + escapeHtml(costLabel) + ': <strong>' +
      formatUsd(total) + '</strong></div>';
    // Per-engine breakdown table.
    const rows = STAGES.map(function (s) {
      const eng = state.engines[s.id] || {};
      const cost = state.costs[s.id];
      if (!eng.engine && cost == null) return "";
      const engineLabel = (eng.engine || "") + (eng.version ? "/" + eng.version : "");
      return (
        '<div class="mvp-summary-row">' +
          '<span>' + escapeHtml(stageLabel(s)) + '</span>' +
          '<span>' + escapeHtml(engineLabel) + '</span>' +
          '<span>' + escapeHtml(formatUsd(cost || 0)) + '</span>' +
        '</div>'
      );
    }).filter(Boolean).join("");
    if (rows) {
      html += '<div class="mvp-summary-table">' + rows + '</div>';
    }
    if (state.mvUrl) {
      html += '<video src="' + state.mvUrl + '" controls style="width:100%;margin-top:8px;border-radius:8px"></video>';
    }
    box.innerHTML = html;
    const saveBtn = panel.querySelector("#mvp-save");
    if (saveBtn) saveBtn.disabled = !state.mvUrl;
  }

  function formatUsd(cents) {
    if (typeof globalThis.formatUsdFromCents === "function") {
      return globalThis.formatUsdFromCents(cents || 0, "$0.00");
    }
    if (!cents) return "$0.00";
    return "$" + (cents / 100).toFixed(2);
  }

  async function postJson(url, body) {
    // CSSOS_PHASE2_P2_54_POSTJSON_DIAG 20260418 — capture rich diagnostics
    // on failure so the stage card can show the REAL upstream error
    // (Runway/MusicGPT/ffmpeg detail) instead of nginx's generic "Internal
    // Server Error" HTML. We keep the response text verbatim in err.rawBody
    // so the user can copy-paste a full bug report.
    let res;
    try {
      res = await fetch(url, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body || {})
      });
    } catch (netErr) {
      const err = new Error("network error: " + (netErr && netErr.message ? netErr.message : String(netErr)));
      err.status = 0;
      err.url = url;
      err.networkError = true;
      err.requestBody = body || null;
      throw err;
    }
    const text = await res.text();
    let json;
    // CSSOS_PHASE2_MV_KEEPALIVE 20260425 #112 — long-running endpoints
    // now stream a chunked-transfer body where the FIRST bytes are
    // single space heartbeats (used to keep nginx from issuing 504)
    // followed by the real JSON. JSON.parse already tolerates leading
    // whitespace, so a simple parse still works. Trim defensively in
    // case any other byte slipped in.
    const trimmedText = text ? text.replace(/^[\s ]+/, "") : text;
    try { json = trimmedText ? JSON.parse(trimmedText) : {}; } catch (_parseErr) { json = null; }
    // Body-level failure: with the keepalive wrapper we always reply
    // HTTP 200 (status is already on the wire when the heartbeat
    // flushed). Successes carry `ok: true`; failures carry
    // `{ok: false, error, detail, status_code}`. Treat body.ok === false
    // as if the HTTP response was non-2xx so the existing error path
    // surfaces a useful message in the stage card.
    const bodyFailed = !!(json && json.ok === false);
    if (!res.ok || bodyFailed) {
      // Extract the most useful human-readable message we can find.
      //   rust-api { ok:false, error, detail }     → detail
      //   RFC 7807 { type, title, status, detail } → detail || title
      //   plain HTML 500                           → snippet of raw text
      //   nothing                                  → HTTP <status>
      let msg = null;
      if (json) {
        msg = json.detail || json.error || json.title || null;
      }
      if (!msg && text) {
        // Strip HTML and keep the first 200 chars so the stage card shows
        // something useful even when nginx serves its default 5xx page.
        const snippet = String(text).replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 200);
        if (snippet) msg = snippet;
      }
      if (!msg) msg = "HTTP " + res.status;
      const err = new Error(msg);
      // Use the body-level status_code when our keepalive wrapper
      // signaled a failure with a 200 wire status.
      err.status = (json && Number(json.status_code)) || res.status;
      err.url = url;
      err.body = json;
      err.rawBody = text;
      err.requestBody = body || null;
      // Always log the full diagnostic to console so devtools has the record.
      try {
        console.error("[mv-pipeline] HTTP " + res.status + " from " + url, {
          responseJson: json,
          responseText: text && text.length > 800 ? text.slice(0, 800) + "…(truncated)" : text,
          requestBody: body || null
        });
      } catch (_logErr) { /* non-fatal */ }
      throw err;
    }
    return json || {};
  }

  // Merges the user's per-stage engine selection into a request body. Returns
  // a new body — never mutates input.
  function withEngine(stageId, body) {
    const sel = selectedEngine(stageId);
    const out = Object.assign({}, body || {});
    if (sel.engine && !out.engine) out.engine = sel.engine;
    if (sel.version && !out.version) out.version = sel.version;
    return out;
  }

  function recordEngine(stageId, payload) {
    const sel = selectedEngine(stageId);
    state.engines[stageId] = {
      engine: payload?.engine || sel.engine || null,
      version: payload?.version || sel.version || null,
      provider_model: payload?.provider_model || null,
      cost_cents: Number(payload?.cost_cents || 0),
      input_tokens: payload?.input_tokens ?? null,
      output_tokens: payload?.output_tokens ?? null
    };
  }

  // P2-24 Jing 2026-04-18: Promise.race helper so every long-running stage can
  // have a hard frontend ceiling without copy-pasting the setTimeout dance.
  // Error message includes stage id so the failure surface is unambiguous.
  function withTimeout(promise, ms, stageId) {
    let timer = null;
    const timeout = new Promise(function (_resolve, reject) {
      timer = setTimeout(function () {
        const err = new Error(
          (stageId || "stage") + " timeout after " + Math.round(ms / 1000) + "s"
        );
        err.code = "stage_timeout";
        err.stage = stageId || null;
        reject(err);
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(function () {
      if (timer) clearTimeout(timer);
    });
  }

  // P2-24 Jing 2026-04-18: music-only autoplay fallback.
  //
  // When the video stage (or anything downstream of music) fails, the user
  // has already paid for + received the audio track — the compose MV is a
  // nice-to-have. Switch to the Music tab, snap the progress rotator to 100,
  // and begin playback so the app never "just stops" at 90%.
  //
  // Returns true if we successfully kicked off audio playback, false otherwise.
  function fallbackToMusicOnly(reason) {
    try {
      if (globalThis.engineProgressState && typeof globalThis.engineProgressState === "object") {
        // Snap everything to 100 so the weighted rotator stops cycling
        // "正在渲染视频 90%" and the Watch panel shows a terminal state.
        globalThis.engineProgressState.music = 100;
        globalThis.engineProgressState.video = 100;
        globalThis.engineProgressState.kara  = 100;
      }
      if (typeof globalThis.syncWatchProgressRotatorModule === "function") {
        globalThis.syncWatchProgressRotatorModule();
      }
    } catch (_progErr) { /* non-fatal */ }

    // If we don't have an audio URL yet we can't play anything — give up.
    if (!state.audioUrl) return false;

    try {
      // Make sure the <audio> element has the src loaded. The preload block
      // in the main pipeline sets this already, but if the failure happened
      // before that ran we set it here as a belt-and-suspenders guard.
      const audioEl = document.getElementById("watch-audio-preview");
      if (audioEl) {
        if (audioEl.src !== state.audioUrl) {
          audioEl.src = state.audioUrl;
          audioEl.preload = "auto";
          if (typeof audioEl.load === "function") audioEl.load();
        }
      }

      // Switch to the Music tab — the MV tab has nothing to show.
      if (typeof globalThis.activateWatchTab === "function") {
        globalThis.activateWatchTab("music");
      }

      // Delegate to the shared music-fallback routine if the Watch module
      // exposes one (it handles labels, retries, and the disc animation).
      if (typeof globalThis.fallbackWatchPlaybackToMusicModule === "function") {
        globalThis.fallbackWatchPlaybackToMusicModule(reason || "Playing music fallback");
        return true;
      }

      // Last-resort: play the preview element directly.
      if (audioEl && typeof audioEl.play === "function") {
        audioEl.play().catch(function () { /* autoplay may be blocked on first load */ });
        return true;
      }
    } catch (err) {
      console.warn("[mv-pipeline] music fallback failed:", err);
    }
    return false;
  }
  // Exposed so other modules (watch playback, dock, etc.) can trigger the
  // same fallback without duplicating logic.
  globalThis.cssmvFallbackToMusicOnly = fallbackToMusicOnly;

  // P2-31: syncWatchOutputs
  //
  // Writes the pipeline's current lyrics+title into #watch-lyrics-editor and a
  // structured storyboard into #watch-script-editor. Called idempotently after
  // every milestone stage (lyrics / music / video / subtitles / compose). Fires
  // "input" events so downstream listeners (watch-ui state.lines parser, song
  // seed sync, etc.) pick up the new text.
  //
  // 一切参数化: title prefix format + section separator are pulled from locale
  // helpers so CN/EN presentation differs only at the join layer.
  function syncWatchOutputs() {
    const copyFn = (typeof copy === "function") ? copy : function (en, zh) {
      return (globalThis.currentLocale === "zh") ? zh : en;
    };
    try {
      const lyricsEl = document.getElementById("watch-lyrics-editor");
      if (lyricsEl) {
        const titleLine = state.title
          ? (globalThis.currentLocale === "zh"
              ? "《" + state.title + "》"
              : state.title)
          : "";
        const body = String(state.lyrics || "").trim();
        const merged = titleLine
          ? (body ? titleLine + "\n\n" + body : titleLine)
          : body;
        if (lyricsEl.value !== merged) {
          lyricsEl.value = merged;
          try { lyricsEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
      }
      const scriptEl = document.getElementById("watch-script-editor");
      if (scriptEl) {
        const parts = [];
        if (state.title) {
          parts.push(copyFn("# Title", "# 标题") + ": " + state.title);
        }
        if (state.prompt) {
          parts.push(copyFn("# Prompt", "# 创意提示") + ":\n" + state.prompt);
        }
        if (state.style) {
          parts.push(copyFn("# Style", "# 风格") + ": " + state.style);
        }
        if (state.duration) {
          parts.push(
            copyFn("# Duration (s)", "# 时长（秒）") + ": " + state.duration.toFixed(1)
          );
        }
        if (state.coverUrl) {
          parts.push(copyFn("# Cover", "# 封面") + ": " + state.coverUrl);
        }
        if (state.videoUrl) {
          parts.push(copyFn("# Video", "# 视频") + ": " + state.videoUrl);
        }
        // Build rough storyboard sections from lyrics — split on blank lines.
        // This is a stop-gap until a real LLM-written storyboard exists.
        if (state.lyrics) {
          const sections = String(state.lyrics)
            .split(/\n{2,}/)
            .map(function (s) { return s.trim(); })
            .filter(Boolean);
          const sectionHdr = copyFn("# Storyboard", "# 分镜");
          const sceneLabel = copyFn("Scene", "场景");
          const sceneLines = sections.map(function (sec, i) {
            return sceneLabel + " " + (i + 1) + ":\n" + sec;
          });
          if (sceneLines.length) {
            parts.push(sectionHdr + "\n" + sceneLines.join("\n\n"));
          }
        }
        const merged = parts.join("\n\n");
        if (scriptEl.value !== merged) {
          scriptEl.value = merged;
          try { scriptEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
      }
    } catch (_err) {
      // Non-fatal: editor sync is a UX convenience, not a pipeline requirement.
    }
  }

  // CSSOS_PHASE2_MV_TIER_PICKER_MODAL 20260419 — low-balance check helpers.
  // Returns { needed: true, balanceUsd, neededUsd, tierId } when the user's
  // balance is below 50% of the current tier's creator_credit_usd.
  // Returns { needed: false } when the check passes or can't be performed
  // (missing API, 401/403, malformed response). We default to not prompting
  // on any uncertainty so a flaky /api/billing/status never blocks a run.
  async function shouldPromptLowBalance() {
    const api = globalThis.cssmvTiers;
    if (!api || typeof api.currentTier !== "function") return { needed: false };
    const tier = api.currentTier();
    if (!tier || !tier.pricing) return { needed: false };
    const neededUsd = Number(tier.pricing.creator_credit_usd) || 0;
    if (neededUsd <= 0) return { needed: false };
    let balanceUsd = null;
    try {
      const res = await fetch("/api/billing/status", {
        credentials: "include",
        headers: { Accept: "application/json" },
      });
      if (!res.ok) return { needed: false };
      const json = await res.json();
      const data = (json && json.data) || json || {};
      // billing_status in routes.rs emits { balance_cents, ... } — can also
      // sit inside { authenticated: true, data: {...} } depending on the
      // ok()/no_data() wrappers, so we probe both shapes.
      const cents =
        typeof data.balance_cents === "number" ? data.balance_cents :
        (typeof json.balance_cents === "number" ? json.balance_cents : null);
      if (cents == null) return { needed: false };
      balanceUsd = cents / 100;
    } catch (_err) {
      return { needed: false };
    }
    // Threshold — fire the modal when the balance covers less than half
    // of what the current tier will consume. Gives the user a clear choice
    // (switch to Lite, confirm with current, or cancel).
    if (balanceUsd < neededUsd * 0.5) {
      return {
        needed: true,
        balanceUsd,
        neededUsd,
        tierId: String(tier.id || ""),
      };
    }
    return { needed: false };
  }

  // Dispatch the low-balance open event and await the modal's resolved
  // event. Resolves to { picked: boolean, tierId?: string }. Timeout after
  // 60s to avoid leaking a pending run if the modal script is missing.
  function requestLowBalancePrompt(detail) {
    return new Promise(function (resolve) {
      let done = false;
      function cleanup() {
        globalThis.removeEventListener("cssmv:tier-picker-resolved", onResolved);
        clearTimeout(timer);
      }
      function onResolved(ev) {
        if (done) return;
        done = true;
        cleanup();
        const d = (ev && ev.detail) || {};
        resolve({ picked: !!d.picked, tierId: d.tierId || null, reason: d.reason || "" });
      }
      const timer = setTimeout(function () {
        if (done) return;
        done = true;
        cleanup();
        // Timeout: proceed as if user confirmed — prevents hanging forever
        // on a mis-wired environment. Logs a console warning so ops notices.
        console.warn("[mv-pipeline] low-balance prompt timed out — proceeding with current tier");
        resolve({ picked: true, tierId: detail && detail.tierId, reason: "timeout" });
      }, 60_000);
      globalThis.addEventListener("cssmv:tier-picker-resolved", onResolved);
      try {
        globalThis.dispatchEvent(new CustomEvent("cssmv:request-low-balance-prompt", { detail }));
      } catch (err) {
        done = true;
        cleanup();
        resolve({ picked: true, tierId: detail && detail.tierId, reason: "dispatch_failed" });
      }
    });
  }

  async function runAll(opts) {
    if (state.running) return;
    const panel = document.getElementById(PANEL_ID);
    if (!panel) return;
    const options = opts || {};
    const seed = options.seed || null;

    // CSSOS_PHASE2_MV_TIER_PICKER_MODAL 20260419 — low-balance prompt. Before
    // we spend credit, pull the account balance and compare against the
    // current tier's `creator_credit_usd`. If balance < 50% of that, fire
    // the tier picker with mode="low-balance" and wait for the user to
    // either pick a cheaper tier, confirm-with-current, or cancel.
    // Silent (options._bypassTierPrompt) lets the modal-resolved handler
    // re-enter runAll without re-prompting.
    if (!options._bypassTierPrompt) {
      try {
        const needsPrompt = await shouldPromptLowBalance();
        if (needsPrompt && needsPrompt.needed) {
          const picked = await requestLowBalancePrompt(needsPrompt);
          if (!picked.picked) {
            // User cancelled / dismissed — abort the run quietly.
            return;
          }
          // Re-enter runAll with the (possibly updated) tier selection.
          return runAll(Object.assign({}, options, { _bypassTierPrompt: true }));
        }
      } catch (_err) { /* non-fatal — proceed without the prompt */ }
    }
    // P2-62 — resume support. When `resumeAt` is supplied (e.g. user clicked
    // a stuck music stage), compute the stage index to start from. All
    // earlier stages retain their prior state (coverUrl/lyrics/audioUrl/etc.)
    // so we don't pay to regenerate them. When `resumeAt` is missing or
    // invalid we treat it as a full run from stage 0.
    const resumeAt = options.resumeAt ? String(options.resumeAt) : "";
    const resumeStartIdx = resumeAt
      ? Math.max(0, STAGE_ORDER.indexOf(resumeAt))
      : 0;
    const isResume = resumeStartIdx > 0;
    state.prompt = (panel.querySelector("#mvp-prompt").value || "").trim();
    state.style = (panel.querySelector("#mvp-style").value || "").trim();
    state.lyrics = (panel.querySelector("#mvp-lyrics").value || "").trim();
    // Seed from caller (universal entry) has priority over empty inputs.
    if (seed) {
      if (!state.prompt && seed.prompt) state.prompt = String(seed.prompt).trim();
      if (!state.style && seed.style) state.style = String(seed.style).trim();
      if (!state.lyrics && seed.lyrics) state.lyrics = String(seed.lyrics).trim();
    }
    // P2-41 Jing 2026-04-18: wire UI/creation language into pipeline state so
    // the lyrics LLM call actually gets language="ja"/"ko"/"fr"/etc. when UI
    // is in that language. 使用 primary helper 返回完整 ISO 主码 (ko/fr/es...)，
    // 不做 zh/ja/en 的人为收敛 — LLM 对 16 种主流语言都能原生生成。
    const cs = globalThis.creationState || {};
    const uiPrimaryLang = globalThis.resolveUiPrimaryLanguageModule?.()
      || globalThis.resolveUiDefaultCreationLanguageModule?.()
      || "en";
    const seedLang = seed && seed.language ? String(seed.language).trim().toLowerCase() : "";
    const csLang = String(cs.language || "").trim().toLowerCase();
    state.language = seedLang || csLang || uiPrimaryLang;
    state.creationLanguage = state.language;
    const seedCiv = seed && seed.civilization ? String(seed.civilization).trim() : "";
    state.civilization = seedCiv || String(cs.civilization || "").trim() || null;
    const seedFrame = seed && (seed.culturalFrame || seed.cultural_frame) ? String(seed.culturalFrame || seed.cultural_frame).trim() : "";
    state.culturalFrame = seedFrame || String(cs.culturalFrame || cs.cultural_frame || "").trim() || null;
    // Zero-input principle: 缺啥补啥 + 零输入必须随机. If prompt is still
    // empty, synthesise one from the local seed bank. Style is also filled
    // in from the bank when missing so the music stage gets a real tag.
    if (!state.prompt) {
      const synth = synthesizeZeroInputSeed();
      state.prompt = synth.prompt;
      if (!state.style) state.style = synth.style;
    } else if (!state.style) {
      // Prompt provided but style missing — still randomise style so music
      // engine doesn't fall back to a single default.
      state.style = pickOne(ZERO_INPUT_STYLE_BANK);
    }
    // Reflect the synthesised/seeded values back into the input fields so
    // the user can see what got rendered (and edit before re-running).
    const promptEl = panel.querySelector("#mvp-prompt");
    const styleEl = panel.querySelector("#mvp-style");
    const lyricsEl = panel.querySelector("#mvp-lyrics");
    if (promptEl && !promptEl.value) promptEl.value = state.prompt;
    if (styleEl && !styleEl.value) styleEl.value = state.style;
    if (lyricsEl && !lyricsEl.value && state.lyrics) lyricsEl.value = state.lyrics;
    // Make sure the engines catalog is loaded before we send any request with
    // engine/version selections, so the fallback defaults are populated from
    // the server.
    if (globalThis.cssmvEngines?.fetchCatalog) {
      try { await globalThis.cssmvEngines.fetchCatalog(false); } catch (_err) { /* ignore */ }
      refreshStageBadges();
    }
    state.running = true;
    if (!isResume) {
      state.costs = {};
      state.engines = {};
      state.coverUrl = null;
      state.audioUrl = null;
      state.videoUrl = null;
      state.subtitlesSrt = null;
      state.mvUrl = null;
    } else {
      // On resume, preserve prior outputs and per-stage cost/engine records
      // for completed stages. Only clear the slots we're about to rerun.
      if (resumeStartIdx <= STAGE_ORDER.indexOf("cover"))     state.coverUrl     = null;
      if (resumeStartIdx <= STAGE_ORDER.indexOf("music"))     state.audioUrl     = null;
      if (resumeStartIdx <= STAGE_ORDER.indexOf("video"))     state.videoUrl     = null;
      if (resumeStartIdx <= STAGE_ORDER.indexOf("subtitles")) state.subtitlesSrt = null;
      if (resumeStartIdx <= STAGE_ORDER.indexOf("compose"))   state.mvUrl        = null;
    }
    // P2-51: resolve the output aspect-ratio spec ONCE per pipeline run so
    // the cover image, video, and ffmpeg compose all agree on the same
    // target ratio. This is what makes "regenerate at target ratio" work
    // end-to-end — no letterbox, no forced crop, no mismatch between the
    // cover's portrait/landscape intent and the final video frame.
    try {
      if (typeof globalThis.resolveCreationAspectRatio === "function") {
        state.outputSpec = globalThis.resolveCreationAspectRatio();
      }
    } catch (_specErr) {
      state.outputSpec = null;
    }
    if (!state.outputSpec) {
      // Hard fallback to 16:9 so legacy builds that somehow don't load
      // app.aspect-ratio.js still produce valid Runway requests.
      state.outputSpec = {
        presetKey: "16:9",
        width: 1920,
        height: 1080,
        runwayImageRatio: "1920:1080",
        runwayVideoRatio: "1280:720",
        cssAspect: "1920 / 1080",
        orientation: "landscape"
      };
    }
    // Push the CSS var so the Watch preview frame matches this run's spec.
    try {
      if (typeof globalThis.applyAspectRatioCssVar === "function") {
        globalThis.applyAspectRatioCssVar(state.outputSpec);
      }
    } catch (_cssErr) { /* non-fatal — preview just falls back to the stylesheet default */ }
    if (!isResume) {
      state.duration = 0;
      state.title = "";        // P2-31: reset title at run start
    }
    // Only reset the stage-state for stages we're actually going to rerun.
    // Earlier stages keep their prior "done" marker so the top-border bars
    // stay complete for them and we don't visually regress.
    STAGES.forEach(function (s, idx) {
      if (idx >= resumeStartIdx) setStage(s.id, "idle", "", 0);
    });
    try {
      if (!isResume && typeof globalThis.cssmvStageBarsReset === "function") {
        globalThis.cssmvStageBarsReset();
      }
      if (typeof globalThis.cssmvStageBarsShow === "function") {
        globalThis.cssmvStageBarsShow();
      }
      // P2-28b: clear any prior MV art title only on a full run; on resume
      // the title surface may already have useful content from the last pass.
      if (!isResume && typeof globalThis.cssmvHideMvArtTitle === "function") {
        globalThis.cssmvHideMvArtTitle();
      }
    } catch (_err) { /* non-fatal */ }
    renderSummary();
    try {
      // Stage 1 — cover (+ 4 parallel variations for 5-image slideshow)
      if (STAGE_ORDER.indexOf("cover") >= resumeStartIdx) {
      setStage("cover", "running", "");
      const coverSuffix = (globalThis.currentLocale === "zh")
        ? COVER_PROMPT_SUFFIX_ZH
        : COVER_PROMPT_SUFFIX_EN;
      const cover = await postJson(
        "/api/mv/cover",
        withEngine("cover", {
          prompt: state.prompt + coverSuffix,
          // P2-51: target ratio for cover image. Backend passes it through to
          // Runway's `ratio` param; Runway generates at that ratio natively.
          ratio: state.outputSpec && state.outputSpec.runwayImageRatio
            ? state.outputSpec.runwayImageRatio
            : null
        })
      );
      state.coverUrl = cover.image_url;
      recordEngine("cover", cover);
      setStage("cover", "done", cover.image_url, cover.cost_cents);
      // Kick off slideshow with the first cover immediately, then spawn 4 parallel
      // variation calls. Slideshow renders on Watch panel #watch-svg (MV tab) and
      // #watch-music-art + #watch-music-disc (Music tab). Music tab persists;
      // MV tab auto-hands-off to video when video.play fires.
      try {
        if (typeof globalThis.cssmvSetCoverSlides === "function") {
          globalThis.cssmvSetCoverSlides([cover.image_url]);
        }
        if (typeof globalThis.cssmvStartCoverSlideshow === "function") {
          globalThis.cssmvStartCoverSlideshow({ mv: true, music: true });
        }
        const variationSuffixesZh = ["，特写", "，广角", "，侧光", "，柔雾"];
        const variationSuffixesEn = [", close-up framing", ", wide-angle composition", ", rim light", ", soft haze"];
        const variationSuffixes = (globalThis.currentLocale === "zh")
          ? variationSuffixesZh
          : variationSuffixesEn;
        variationSuffixes.forEach(function (suffix) {
          // Fire-and-forget — don't block the pipeline on variations.
          postJson(
            "/api/mv/cover",
            withEngine("cover", {
              prompt: state.prompt + coverSuffix + suffix,
              // P2-51: variations must match the primary cover's aspect ratio
              // so the slideshow stays visually cohesive inside the preview frame.
              ratio: state.outputSpec && state.outputSpec.runwayImageRatio
                ? state.outputSpec.runwayImageRatio
                : null
            })
          )
            .then(function (extra) {
              if (!extra || !extra.image_url) return;
              if (typeof globalThis.cssmvAddCoverSlide === "function") {
                globalThis.cssmvAddCoverSlide(extra.image_url);
              }
            })
            .catch(function (_err) { /* variation failures are non-fatal */ });
        });
      } catch (_slideshowErr) {
        // Slideshow is a non-blocking UX enhancement; errors shouldn't fail the pipeline.
      }
      } // end Stage 1 (cover) resume guard

      // Stage 2 — lyrics (real LLM call when user provided no lyrics)
      if (STAGE_ORDER.indexOf("lyrics") >= resumeStartIdx) {
      setStage("lyrics", "running", "");
      if (!state.lyrics) {
        // P2-41 Jing 2026-04-18: pass language + civilization to LLM so the
        // lyrics come back in the intended locale and cultural frame. Without
        // this, the backend default prompt always produces EN/ZH lyrics.
        const lyricsResp = await postJson(
          "/api/mv/lyrics",
          withEngine("lyrics", {
            prompt: state.prompt,
            style: state.style || null,
            language: state.language || state.creationLanguage || null,
            civilization: state.civilization || null,
            cultural_frame: state.culturalFrame || null
          })
        );
        state.lyrics = String(lyricsResp.lyrics || "").trim();
        recordEngine("lyrics", lyricsResp);
        setStage(
          "lyrics",
          "done",
          state.lyrics.slice(0, 120) + (state.lyrics.length > 120 ? "…" : ""),
          lyricsResp.cost_cents || 0
        );
        // P2-31: push lyrics into Watch Lyrics/Script tabs (title prepended later after music stage).
        syncWatchOutputs();
      } else {
        // User-provided lyrics don't incur LLM cost; still record the stage.
        state.engines["lyrics"] = {
          engine: "user",
          version: "manual",
          provider_model: null,
          cost_cents: 0,
          input_tokens: null,
          output_tokens: null
        };
        setStage(
          "lyrics",
          "done",
          state.lyrics.slice(0, 120) + (state.lyrics.length > 120 ? "…" : ""),
          0
        );
        // P2-31: push user-provided lyrics into Watch tabs too.
        syncWatchOutputs();
      }
      } // end Stage 2 (lyrics) resume guard

      // Stage 3 — music
      if (STAGE_ORDER.indexOf("music") >= resumeStartIdx) {
      setStage("music", "running", "");
      const music = await postJson(
        "/api/mv/music",
        withEngine("music", {
          prompt: state.prompt,
          music_style: state.style || null,
          lyrics: state.lyrics,
          make_instrumental: false
        })
      );
      state.audioUrl = music.audio_url;
      state.duration = Number(music.duration_secs || 0);
      state.title = String(music.title || "").trim();   // P2-31: capture title for Watch editors
      // P2-36: publish the authoritative title into the global creation state
      // so notifications panel + works center commit see the SAME title as
      // the Watch panel. Previously each surface resolved a title from its
      // own source (Watch ← mv-pipeline state, Notifications ← app.js state,
      // Works ← state.prompt slice), producing three different titles for
      // one song. Now the music engine's title is the single source of truth.
      try {
        if (state.title) {
          if (globalThis.state && typeof globalThis.state === "object") {
            globalThis.state.title = state.title;
          }
          window.dispatchEvent(new CustomEvent("cssos:title_resolved", {
            detail: {
              title: state.title,
              run_id: String(globalThis.activePipelineRunId || globalThis.currentWatchAudioRunId || "").trim()
            }
          }));
        }
      } catch (_titleSyncErr) { /* non-fatal */ }
      recordEngine("music", music);
      setStage(
        "music",
        "done",
        (music.title || "Track") + " · " + (state.duration ? state.duration.toFixed(1) + "s" : ""),
        music.cost_cents
      );
      // P2-31: re-sync editors now that title + duration are known.
      syncWatchOutputs();

      // P2-34: preload <audio> for the music-tab fallback path.
      //
      // If video autoplay is blocked later (mobile Safari, Tesla, sandboxed
      // iframe, etc.), `attemptWatchVideoPlaybackModule` will bounce the user
      // to the Music tab. For that fallback to be *zero-click*, the audio
      // element must already be loaded and ready to play.
      try {
        const audioEl = document.getElementById("watch-audio-preview");
        if (audioEl && state.audioUrl) {
          audioEl.src = state.audioUrl;
          audioEl.preload = "auto";
          // Do not start playback here — playback begins when the user lands
          // on the Music tab (either via compose-done autoplay or the blocked
          // video fallback). Pre-loading only.
          if (typeof audioEl.load === "function") {
            audioEl.load();
          }
        }
      } catch (_audioWarmErr) {
        console.warn("[mv-pipeline] music preload failed:", _audioWarmErr);
      }
      } // end Stage 3 (music) resume guard

      // Stage 4 — video
      //
      // P2-24 Jing 2026-04-18: wrap in VIDEO_TIMEOUT_MS race AND a try/catch
      // so a hanging Runway task falls back to music-only playback instead
      // of stalling the Watch panel at "正在渲染视频 90%" forever.
      //
      // Failure modes we now survive gracefully:
      //   * Runway poll loop exceeds server overall_timeout (600s) → upstream 5xx
      //   * Runway accepts the task but never returns SUCCEEDED → frontend 180s
      //   * Rust api-vm process killed mid-call → fetch throws
      //   * RUNWAY_API_KEY missing on api-vm → upstream 500 "NotConfigured"
      //
      // In all of these, we still hand the user a playable audio track
      // (which was already generated + preloaded at stage 3).
      let video = null;
      let videoFailed = false;
      let videoErrorMsg = "";
      // CSSOS_PHASE2_LITE_SEGMENT_PLANNER 20260426 #47 — Jing
      // Lite tier is image-only by definition. Skipping /api/mv/video saves
      // ~$0.60 of Runway gen4_turbo per run. The compose call later routes
      // to the Ken-Burns-segments path so an empty state.videoUrl is fine.
      // Mark the video stage as `skipped` (not `error`) so the Watch panel
      // bar shows a clean done-skip instead of a red failure.
      let _liteSkipsVideo = false;
      try {
        if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.currentTierId === "function") {
          _liteSkipsVideo = String(globalThis.cssmvTiers.currentTierId() || "").toLowerCase() === "lite";
        }
      } catch (_e) { /* ignore */ }
      if (_liteSkipsVideo && STAGE_ORDER.indexOf("video") >= resumeStartIdx) {
        state.engines["video"] = {
          engine: "skipped",
          version: "lite_tier",
          provider_model: null,
          cost_cents: 0,
          input_tokens: null,
          output_tokens: null
        };
        state.videoUrl = null;
        setStage(
          "video",
          "done",
          copy(
            "Skipped (Lite tier · slideshow only)",
            "已跳过（Lite 档 · 仅幻灯片）"
          ),
          0
        );
      }
      if (!_liteSkipsVideo && STAGE_ORDER.indexOf("video") >= resumeStartIdx) {
      setStage("video", "running", "");
      // CSSOS_PHASE2_P2_54_VIDEO_FIX 20260418 — Runway Gen-3 Turbo only
      // accepts { duration: 5|10, ratio: 1280:768|768:1280 }. P2-51 started
      // sending Gen-4 ratios (1280:720, 960:960, 1584:672, …) and duration
      // up to 30s, which Runway rejects upstream → rust-api 502
      // "upstream_failed", which nginx/Cloudflare rewrites to 500 "Internal
      // Server Error" in the browser. Two synchronised fixes:
      //   1) clamp duration to the exact set {5, 10} (Runway literal)
      //   2) explicitly request `model: "gen4_turbo"` so the backend knows
      //      the Gen-4 ratio is legal. Backend's RunwayClient passes model
      //      through verbatim; falls back to gen3a_turbo only if `model` is
      //      absent.
      const rawDuration = state.duration ? Math.round(state.duration) : VIDEO_DEFAULT_DURATION_SECS;
      const clampedDuration = rawDuration >= 8 ? 10 : 5;
      const videoRatio = state.outputSpec && state.outputSpec.runwayVideoRatio
        ? state.outputSpec.runwayVideoRatio
        : "1280:720";
      // Gen-4 Turbo is required for P2-51 ratios (720p-class) and for
      // square / 21:9 / 32:9. Gen-3 Turbo would 400 on these.
      const videoModel = "gen4_turbo";
      try {
        video = await withTimeout(
          postJson(
            "/api/mv/video",
            withEngine("video", {
              prompt_image_url: state.coverUrl,
              prompt_text: state.prompt,
              duration_secs: clampedDuration,
              ratio: videoRatio,
              model: videoModel
            })
          ),
          VIDEO_TIMEOUT_MS,
          "video"
        );
      } catch (videoErr) {
        videoFailed = true;
        videoErrorMsg = videoErr && videoErr.message ? videoErr.message : String(videoErr);
        console.warn("[mv-pipeline] video stage failed, falling back to music-only:", videoErr);
        // Tag the stage card so the user sees what happened — not just a silent pass.
        setStage(
          "video",
          "error",
          copy(
            "Video failed (" + videoErrorMsg + ") · playing music fallback",
            "视频失败（" + videoErrorMsg + "）· 已切换到音乐播放"
          ),
          0
        );
        // CSSOS_PHASE2_P2_54_NO_FAKE_GREEN 20260418 — the previous code marked
        // subtitles + compose as "done" when video failed, which painted them
        // green and gave Jing the wrong signal ("都绿了但实际没通"). Mark them
        // as error so the Watch panel's stage bars + summary clearly show the
        // pipeline did NOT produce an MV. Music-only fallback still plays.
        state.engines["subtitles"] = {
          engine: "skipped",
          version: "video_failed",
          provider_model: null,
          cost_cents: 0,
          input_tokens: null,
          output_tokens: null
        };
        setStage("subtitles", "error", copy(
          "Not run — video stage failed upstream",
          "未运行 — 视频阶段上游失败"
        ), 0);
        state.engines["compose"] = {
          engine: "skipped",
          version: "video_failed",
          provider_model: null,
          cost_cents: 0,
          input_tokens: null,
          output_tokens: null
        };
        setStage("compose", "error", copy(
          "Not run — video stage failed upstream",
          "未运行 — 视频阶段上游失败"
        ), 0);
        // Fire music-only autoplay so the user still gets something.
        fallbackToMusicOnly(copy(
          "Video timed out · playing music",
          "视频超时 · 播放音乐"
        ));
        renderSummary();
      }

      if (!videoFailed) {
        state.videoUrl = video.video_url;
        // CSSOS_PHASE2_HYBRID_MIXER 20260426 #132 — Jing
        // Remember the requested clip duration so the Hybrid segment planner
        // can splice it into the timeline at the correct length. Backends
        // sometimes return Number(video.duration_secs); fall back to the
        // duration we asked Runway for (5 | 10).
        state.videoDurSecs =
          (video && Number(video.duration_secs) > 0)
            ? Number(video.duration_secs)
            : clampedDuration;
        recordEngine("video", video);
        setStage("video", "done", video.video_url, video.cost_cents);
        // P2-31: re-sync editors now that video URL is known (storyboard line appears).
        syncWatchOutputs();
      }

      // If video failed, short-circuit the rest of the pipeline. The user
      // already has audio playing via the fallback; subtitles + compose
      // depend on the video URL so there's nothing meaningful to do.
      if (videoFailed) {
        state.running = false;
        return;
      }
      } // end Stage 4 (video) resume guard

      // Stage 5 — subtitles (real /api/mv/subtitles call)
      if (STAGE_ORDER.indexOf("subtitles") >= resumeStartIdx) {
      setStage("subtitles", "running", "");
      try {
        // CSSMV_CONSOLE_CLEANUP 20260423 #88 — Jing: the only implemented
        // subtitles engine today is cssmv-local/srt-v1. If the user's picker
        // selected anything else, omit the engine so the backend falls back to
        // the stage default instead of returning 501 Not Implemented (which
        // paints the console red).
        const subtitlesBody = withEngine("subtitles", {
          lyrics: state.lyrics,
          duration_secs: state.duration || SUBTITLES_DEFAULT_DURATION_SECS
        });
        if (subtitlesBody.engine && subtitlesBody.engine !== "cssmv-local") {
          delete subtitlesBody.engine;
          delete subtitlesBody.version;
        }
        const subs = await postJson("/api/mv/subtitles", subtitlesBody);
        state.subtitlesSrt = subs.srt || null;
        recordEngine("subtitles", subs);
        setStage(
          "subtitles",
          "done",
          copy(
            String(subs.line_count || 0) + " lines · " + (subs.engine || "") + "/" + (subs.version || ""),
            (subs.line_count || 0) + " 行 · " + (subs.engine || "") + "/" + (subs.version || "")
          ),
          subs.cost_cents || 0
        );
      } catch (subErr) {
        // Subtitles are non-fatal: keep the pipeline going without them.
        state.subtitlesSrt = null;
        state.engines["subtitles"] = {
          engine: "skipped",
          version: "none",
          provider_model: null,
          cost_cents: 0,
          input_tokens: null,
          output_tokens: null
        };
        setStage(
          "subtitles",
          "done",
          copy(
            "Subtitles skipped (" + (subErr.message || "unknown") + ")",
            "字幕已跳过（" + (subErr.message || "未知原因") + "）"
          ),
          0
        );
      }
      } // end Stage 5 (subtitles) resume guard

      // Stage 6 — compose
      //
      // P2-34: wrap in a hard timeout so a hung Rust ffmpeg mux does not
      // leave the UI stuck at "96%" forever. If compose times out, we
      // still proceed to the music-only fallback path below.
      // P2-24 Jing 2026-04-18: reuse the shared withTimeout helper and
      // gracefully fall back to music-only if compose fails/times out.
      if (STAGE_ORDER.indexOf("compose") >= resumeStartIdx) {
      setStage("compose", "running", "");
      const mvId = "mv_" + Date.now();
      let composed = null;
      let composeFailed = false;
      try {
        // CSSOS_PHASE2_LITE_SEGMENT_PLANNER 20260426 #47 — Jing
        // Resolve current MV tier (lite | hybrid | cinematic). Lite users
        // get a Ken-Burns slideshow over the cover image; the backend's
        // xfade chain (compose_xfade_chain, #126) glues the slides with
        // 1.2s cross-dissolves. Hybrid + Cinematic still go through the
        // single-AI-video path until #127 (slider) ships.
        let _liteTierId = "hybrid";
        try {
          if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.currentTierId === "function") {
            _liteTierId = String(globalThis.cssmvTiers.currentTierId() || "hybrid").toLowerCase();
          }
        } catch (_e) { /* fall through */ }
        const _litePlan = planComposeSegments({
          tierId: _liteTierId,
          coverUrl: state.coverUrl,
          durationSecs: state.duration,
          // CSSOS_PHASE2_HYBRID_MIXER 20260426 #132 — pass the AI clip URL
          // and its duration so Hybrid/Cinematic can splice it into the
          // timeline instead of leaving it on the cutting-room floor.
          aiVideoUrl: state.videoUrl,
          aiVideoDurSecs: state.videoDurSecs
        });
        const _composeBase = {
          mv_id: mvId,
          audio_url: state.audioUrl,
          subtitles_srt: state.subtitlesSrt,
          // CSSOS_PHASE2_P2_97_COMPOSE_AR 20260424 — honor the per-run
          // aspect spec resolved at runAll() start so ffmpeg composes to
          // the canvas the user picked (Landscape/Portrait/Square/4:5/
          // 21:9/2.39:1/32:9/Custom) instead of defaulting to 1920×1080.
          // Backend ComposeRequest already accepts width/height as
          // Option<u32> (mv_compose.rs) so this is a zero-risk additive
          // change for old runs that still send only mv_id/*_url.
          width: state.outputSpec && state.outputSpec.width
            ? state.outputSpec.width : null,
          height: state.outputSpec && state.outputSpec.height
            ? state.outputSpec.height : null
        };
        // CSSOS_PHASE2_HYBRID_MIXER_DEBUG 20260426 #132b — Jing
        // The Hybrid AI video was reportedly still ignored on user end.
        // Loud diagnostic log so we can see EXACTLY what happens at compose
        // time. Paste these lines from DevTools console when reporting bugs.
        console.info(
          "[mv-pipeline][compose-decision] tier=%s · cover=%s · audio=%s · video=%s · videoDur=%s · plan=%s · segments=%s",
          _liteTierId,
          state.coverUrl ? "yes" : "no",
          state.audioUrl ? "yes" : "no",
          state.videoUrl ? state.videoUrl.slice(0, 80) + "…" : "no",
          state.videoDurSecs || 0,
          _litePlan ? _litePlan.plan : "none",
          _litePlan && _litePlan.segments ? _litePlan.segments.length : 0
        );
        if (_litePlan && _litePlan.segments && _litePlan.segments.length >= 2) {
          _composeBase.segments = _litePlan.segments;
          // video_url intentionally omitted on the segments path — backend
          // dispatches on segments[]. The Hybrid/Cinematic plan ALREADY
          // includes the AI video clip as one of the segments, so the
          // backend doesn't need it as a separate top-level URL.
          if (_litePlan.plan === "hybrid_mixer") {
            console.info(
              "%c[mv-pipeline] Hybrid mixer ACTIVE: " + _litePlan.kbCount +
              " Ken Burns × " + _litePlan.kbEachSecs.toFixed(2) +
              "s + 1 AI clip × " + _litePlan.aiClipSecs.toFixed(2) +
              "s with " + _litePlan.transitionSecs.toFixed(2) + "s xfade",
              "color:#0f0;font-weight:bold"
            );
          } else {
            console.info(
              "[mv-pipeline] Lite slideshow plan: " + _litePlan.segmentCount +
              " slides × " + _litePlan.eachSecs.toFixed(2) + "s with " +
              _litePlan.transitionSecs.toFixed(2) + "s xfade"
            );
          }
        } else {
          // Hybrid / Cinematic with NO segments path → real video gets
          // truncated by `-shortest` in compose_legacy. Warn loudly because
          // this is a money-leak bug for the user. Should never happen
          // unless state.videoUrl is null (video stage skipped/failed) or
          // the user picked an unknown tier.
          if (_liteTierId === "hybrid" || _liteTierId === "cinematic") {
            console.warn(
              "%c[mv-pipeline] WARN: " + _liteTierId +
              " tier fell through to legacy single-clip path — AI video " +
              "would be wasted. videoUrl=%s, coverUrl=%s, plan=%s",
              "color:#f80;font-weight:bold",
              state.videoUrl ? "set" : "MISSING",
              state.coverUrl ? "set" : "MISSING",
              _litePlan ? _litePlan.plan : "null"
            );
          }
          _composeBase.video_url = state.videoUrl;
        }
        composed = await withTimeout(
          postJson(
            "/api/mv/compose",
            withEngine("compose", _composeBase)
          ),
          COMPOSE_TIMEOUT_MS,
          "compose"
        );
      } catch (composeErr) {
        composeFailed = true;
        const composeMsg = composeErr && composeErr.message ? composeErr.message : String(composeErr);
        console.warn("[mv-pipeline] compose stage failed, falling back to music-only:", composeErr);
        setStage(
          "compose",
          "error",
          copy(
            "Compose failed (" + composeMsg + ") · playing music fallback",
            "合成失败（" + composeMsg + "）· 已切换到音乐播放"
          ),
          0
        );
        fallbackToMusicOnly(copy(
          "Compose timed out · playing music",
          "合成超时 · 播放音乐"
        ));
        renderSummary();
        state.running = false;
        return;
      }

      state.mvUrl = composed.public_url;
      recordEngine("compose", composed);
      setStage("compose", "done", composed.public_url, composed.cost_cents || 0);
      // P2-31: final sync so anything that appeared late (e.g. mvUrl) is reflected.
      syncWatchOutputs();
      renderSummary();

      // ──────────────────────────────────────────────────────────────
      // P2-34: zero-click autoplay.
      //
      // The Watch panel title was stalling at "正在渲染视频 96%" because:
      //   1. The progress label is driven by `engineProgressState.{video,kara}`
      //      populated by the creative-engine polling path (app.watch-audio-polling.js),
      //      NOT by the MV pipeline panel. Those fields stayed <100 after compose
      //      finished.
      //   2. Nothing pushed the final `mvUrl` into `watchVideo.src` or called
      //      `attemptWatchVideoPlaybackModule`, so no auto-play ever fired.
      //
      // Fix (zero input UX — 零门槛):
      //   a) Force engineProgressState.{music,video,kara} to 100 so the label
      //      snaps to the "Complete" card and the weighted rotator stops at 100%.
      //   b) Activate the MV tab and load the composed public_url into the
      //      <video> element.
      //   c) Try `attemptWatchVideoPlaybackModule` with fallback — if the
      //      browser blocks autoplay, it will fall back to the Music tab
      //      which already has the audio preloaded (see music-stage block below).
      try {
        if (globalThis.engineProgressState && typeof globalThis.engineProgressState === "object") {
          globalThis.engineProgressState.music = 100;
          globalThis.engineProgressState.video = 100;
          globalThis.engineProgressState.kara  = 100;
        }
        if (typeof globalThis.syncWatchProgressRotatorModule === "function") {
          globalThis.syncWatchProgressRotatorModule();
        }

        // CSSMV_CONSOLE_CLEANUP 20260423 #89 — Jing: "祖国江山一片红".
        // `composed.public_url` points at /artifacts/mv/<mv_id>.mp4, served by
        // nginx from /var/lib/cssos/mv/. On a healthy build the file is there
        // by the time the Rust handler returns. But there are two windows
        // where the URL resolves to a 404 and the <video> element paints the
        // console red:
        //   1. The run is resumed from history/notifications after the file
        //      has been TTL-pruned from /var/lib/cssos/mv/.
        //   2. A proxy between us and nginx cached a 404 from a prior failed
        //      build while the backend was still finishing the retry.
        // HEAD-probe the URL before handing it to <video>. If it 404s, skip
        // the video tab and fall straight into the music-only fallback —
        // that's what the user ends up with anyway, but without the red
        // "Failed to load resource: 404" line.
        let mvUrlPlayable = true;
        if (state.mvUrl) {
          try {
            const probe = await fetch(state.mvUrl, { method: "HEAD", cache: "no-store" });
            if (!probe.ok) {
              mvUrlPlayable = false;
              console.info(
                "[mv-pipeline] composed MV unavailable (status " + probe.status +
                ") — falling back to music-only. URL:", state.mvUrl
              );
            }
          } catch (probeErr) {
            // Network error on HEAD; let the <video> element try anyway —
            // browsers sometimes block HEAD but allow GET on the same origin.
            console.info("[mv-pipeline] HEAD probe failed (network); attempting video load anyway:", probeErr);
          }
        }

        if (mvUrlPlayable && state.mvUrl && typeof globalThis.setWatchVideoFromArtifact === "function") {
          // Push MV URL into the Watch <video> element.
          globalThis.setWatchVideoFromArtifact(state.mvUrl, { sourceKind: "mv-pipeline-final" });
        }
        // Switch to MV tab so the user lands on the composed MV — but only
        // if the file is actually playable. Otherwise stay on Music.
        if (mvUrlPlayable && typeof globalThis.activateWatchTab === "function") {
          globalThis.activateWatchTab("mv");
        }
        if (!mvUrlPlayable) {
          if (typeof globalThis.fallbackWatchPlaybackToMusicModule === "function") {
            globalThis.fallbackWatchPlaybackToMusicModule(copy(
              "Composed video not available · playing music",
              "合成视频不可用 · 已切换到音乐播放"
            ));
          }
        } else if (typeof globalThis.attemptWatchVideoPlaybackModule === "function") {
          // Attempt playback with retry + music-tab fallback baked in.
          globalThis.attemptWatchVideoPlaybackModule({
            maxRetries: 3,
            interval: 800,
            allowFallback: true
          });
        } else if (state.mvUrl) {
          // Fallback: direct play if the Watch module is not loaded yet.
          const v = document.getElementById("watch-video");
          if (v && typeof v.play === "function") {
            v.play().catch(function () {
              // Autoplay blocked — swap to music tab which has audio preloaded.
              if (typeof globalThis.fallbackWatchPlaybackToMusicModule === "function") {
                globalThis.fallbackWatchPlaybackToMusicModule("Autoplay blocked · playing music");
              }
            });
          }
        }
      } catch (_autoplayErr) {
        // Non-fatal — compose still succeeded, user can click play manually.
        console.warn("[mv-pipeline] zero-click autoplay wiring failed:", _autoplayErr);
      }
      } // end Stage 6 (compose) resume guard
    } catch (err) {
      console.error("[mv-pipeline] failed", err);
      const failingStage = findRunningStage() || "cover";
      setStage(failingStage, "error", err.message || String(err));
      // P2-24 Jing 2026-04-18: any uncaught pipeline error must still
      // release the Watch panel from its "rendering…" state. If we have
      // an audio URL by the time we failed, play it; otherwise just snap
      // the rotator to 100 so the UI stops spinning.
      try {
        if (globalThis.engineProgressState && typeof globalThis.engineProgressState === "object") {
          globalThis.engineProgressState.music = 100;
          globalThis.engineProgressState.video = 100;
          globalThis.engineProgressState.kara  = 100;
        }
        if (typeof globalThis.syncWatchProgressRotatorModule === "function") {
          globalThis.syncWatchProgressRotatorModule();
        }
      } catch (_rotErr) { /* non-fatal */ }
      if (state.audioUrl) {
        fallbackToMusicOnly(copy(
          "Pipeline failed · playing music",
          "管线失败 · 播放音乐"
        ));
      }
    } finally {
      state.running = false;
    }
  }

  function findRunningStage() {
    for (const s of STAGES) {
      if (state.stageState[s.id] === "running") return s.id;
    }
    return null;
  }

  async function saveAsWork() {
    if (!state.mvUrl) return;
    try {
      // Build `engine_costs_cents` dynamically so any new stage added to
      // STAGES + COMMIT_COST_KEYS automatically flows through.
      const engineCosts = {};
      STAGES.forEach(function (s) {
        const key = COMMIT_COST_KEYS[s.id];
        if (!key) return;
        engineCosts[key] = Number(state.costs[s.id] || 0);
      });
      // Also persist the engine/version metadata so the work-detail view can
      // show "Cover · runway/gen4-image · $0.08". Unknown keys are ignored
      // by the backend today; when the commit route learns about them it will
      // pick them up automatically.
      const engineMeta = {};
      Object.keys(state.engines).forEach(function (k) {
        const e = state.engines[k];
        if (!e) return;
        engineMeta[k] = {
          engine: e.engine || null,
          version: e.version || null,
          provider_model: e.provider_model || null,
          cost_cents: Number(e.cost_cents || 0),
          input_tokens: e.input_tokens ?? null,
          output_tokens: e.output_tokens ?? null
        };
      });
      const resp = await postJson("/api/mv/commit", {
        // P2-36: prefer the authoritative title resolved by the music engine
        // over the raw user prompt. The prompt is a visual seed, not a song
        // title — using it caused the works center to show a *third*,
        // different title from the Watch panel and notifications panel.
        title:
          (state.title && state.title.trim()) ||
          (state.prompt || "").slice(0, 60) ||
          "Untitled MV",
        style: state.style || null,
        lyrics_preview: state.lyrics ? state.lyrics.slice(0, 200) : null,
        cover_image_url: state.coverUrl,
        preview_image_url: state.coverUrl,
        preview_video_url: state.videoUrl,
        final_mv_url: state.mvUrl,
        engine_costs_cents: engineCosts,
        // Extension point — see server-side /api/mv/commit handler. When the
        // route starts persisting this it will show up in the work detail UI
        // without a frontend change. Today it's additive metadata only.
        engine_meta: engineMeta
      });
      const savedMsg = copy(
        "Saved as work. Total engine cost: ",
        "已保存为作品，成本合计："
      );
      alert(savedMsg + formatUsd(resp.total_engine_cost_cents));
    } catch (err) {
      alert(copy("Save failed: ", "保存失败：") + (err.message || String(err)));
    }
  }

  // Dock wiring — adds a dock item for the MV pipeline panel.
  // Guest gate: the item is always inserted into the DOM (so the layout is
  // stable across login/logout), but it starts with `is-hidden` for guests.
  // The click handler also defensively re-checks auth in case a guest
  // un-hides the item via devtools.
  function ensureDockItem() {
    const dock = document.querySelector(".dock");
    if (!dock) return;
    if (dock.querySelector('[data-action="' + DOCK_ACTION + '"]')) {
      // Already mounted — just re-apply the guest visibility state.
      refreshMvPipelineGuestGate();
      return;
    }
    const item = document.createElement("div");
    item.className = "dock-item";
    item.setAttribute("data-action", DOCK_ACTION);
    item.setAttribute("data-actions", "click");
    item.setAttribute("title", "MV Pipeline");
    item.innerHTML = '<span class="dock-icon">🎞️</span>';
    item.addEventListener("click", function () {
      if (!isMvPipelineAllowedForCurrentUser()) {
        routeGuestToLogin();
        return;
      }
      const panel = ensurePanel();
      panel.classList.remove("hidden");
      if (typeof globalThis.focusPanel === "function") globalThis.focusPanel(panel);
      refreshStageBadges();
    });
    if (!isMvPipelineAllowedForCurrentUser()) {
      item.classList.add("is-hidden");
    }
    dock.appendChild(item);
  }

  function init() {
    ensureDockItem();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  // Unified opener used by the dock, logo taps, right-click 一键MV, the Watch
  // MV/Music tab play button, etc. All universal entry points call this with
  // `{autoStart: true, seed}` so the 6-stage pipeline fires with zero clicks.
  //
  // Options (all optional):
  //   autoStart: boolean — immediately invoke runAll() after mounting.
  //   seed: { prompt?, style?, lyrics? } — pre-filled creative inputs. When
  //     any field is empty, runAll() will synthesise from the local seed bank.
  //   focus: boolean — default true; set false when the caller doesn't want
  //     the panel to steal focus (e.g. background retrigger).
  //   hidden: boolean — when true, mount + pre-fill + optionally autoStart but
  //     leave the panel invisible. Used by universal entries that want the
  //     pipeline to run in the background without the panel popping open.
  globalThis.openMvPipelinePanel = function (options) {
    const opts = options || {};
    // CSSOS_PHASE2_MV_GUEST_GATE — guests may not mount, view, or run the
    // pipeline. Universal entry points (Watch play, logo tap, right-click
    // 一键MV) all funnel through this opener, so this is the single choke
    // point that enforces the login requirement.
    if (!isMvPipelineAllowedForCurrentUser()) {
      // If the caller wanted a silent background run (hidden:true) we just
      // no-op — don't pop up a toast the user didn't trigger. If the caller
      // wanted a visible panel (dock click, explicit open), route to login.
      if (opts.hidden !== true) {
        routeGuestToLogin();
      }
      // Make sure any stale panel is hidden as well.
      const stale = document.getElementById(PANEL_ID);
      if (stale) stale.classList.add("hidden");
      return null;
    }
    const panel = ensurePanel();
    if (opts.hidden !== true) {
      panel.classList.remove("hidden");
      if (opts.focus !== false && typeof globalThis.focusPanel === "function") {
        globalThis.focusPanel(panel);
      }
      // CSSOS_PHASE2_MV_TIER_PICKER_MODAL 20260419 — first-time modal. The
      // modal module itself gates on MODAL_SEEN_KEY and cssmvTiers'
      // hasExplicitSelection() so subsequent opens (and background silent
      // runs via hidden:true) are no-ops. Deferred a tick so the panel
      // frame paints before the overlay slides in.
      setTimeout(function () {
        try {
          const api = globalThis.cssmvTiers;
          const picker = globalThis.cssmvTierPickerModal;
          if (!api || !picker) return;
          if (typeof api.hasExplicitSelection === "function" && api.hasExplicitSelection()) return;
          if (typeof picker.hasSeenFirstTime === "function" && picker.hasSeenFirstTime()) return;
          globalThis.dispatchEvent(new CustomEvent("cssmv:request-tier-picker"));
        } catch (_err) { /* non-fatal */ }
      }, 0);
    }
    refreshStageBadges();
    // Pre-fill inputs from seed so the user can see (and edit) the values
    // that are about to be rendered. Empty fields stay empty — runAll()
    // synthesises from the seed bank when still blank.
    if (opts.seed) {
      const promptEl = panel.querySelector("#mvp-prompt");
      const styleEl = panel.querySelector("#mvp-style");
      const lyricsEl = panel.querySelector("#mvp-lyrics");
      if (promptEl && opts.seed.prompt && !promptEl.value) {
        promptEl.value = String(opts.seed.prompt);
      }
      if (styleEl && opts.seed.style && !styleEl.value) {
        styleEl.value = String(opts.seed.style);
      }
      if (lyricsEl && opts.seed.lyrics && !lyricsEl.value) {
        lyricsEl.value = String(opts.seed.lyrics);
      }
    }
    if (opts.autoStart) {
      // Defer a tick so the DOM updates (and any engine-catalog fetch kicked
      // off by refreshStageBadges) can settle before the first request.
      setTimeout(function () { runAll({ seed: opts.seed || null }); }, 0);
    }
    return panel;
  };

  // Exposed so callers that have already mounted the panel (e.g. advanced
  // settings "apply render" button) can start the pipeline without re-opening.
  globalThis.cssmvRunPipeline = function (opts) { return runAll(opts || {}); };

  // Listen for engine-selection changes (fired by the advanced-settings panel
  // when a user picks a different engine). Refreshes the badge column so the
  // user sees the new engine immediately.
  globalThis.addEventListener("cssmv:engine-selection-changed", function () {
    refreshStageBadges();
  });
  // CSSOS_PHASE2_MV_TIER_LABEL 20260419 — refresh the cost label whenever
  // the user picks a different tier or when the /api/mv/tiers catalog
  // finishes loading for the first time.
  globalThis.addEventListener("cssmv:tier-changed", refreshTierCostLabel);
  globalThis.addEventListener("cssmv:tiers-ready", refreshTierCostLabel);
})();
