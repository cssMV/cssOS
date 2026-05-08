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
  // CSSOS_PHASE2_LONGFORM_COMPOSE_TIMEOUT 20260429 #177 — Jing
  // "Composing MV…99% 红了" — 226s slideshow (23 slides × ~10s each)
  // exceeds the old 120s ffmpeg budget. Bumped to 600s (10 min) so a
  // full-length MV with 5-10 min audio + 20-30 slides + xfade chain has
  // headroom to finish even on slower runners.
  const COMPOSE_TIMEOUT_MS = 600000;

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
    // CSSOS_PHASE2_COMPOSE_ETA 20260429 #183 — Jing
    // "Composing MV 总是卡在 99%" — root cause: etaSecs was 6 s but real
    // ffmpeg xfade chain for 20+ segments takes 3-4 min. The asymptotic
    // 99.5% cap then looked like a permanent stall. 180 s tracks the real
    // xfade-chain timing (observed 213 s for 23 segments, 19:34→19:37 logs).
    // The runner overrides this dynamically when segment count is known.
    { id: "compose",   etaSecs: 180, progressVerbKey: "mv.stage.compose.verb", labelEn: "MV compose", labelZh: "MV 合成",   verbEn: "Composing MV",       verbZh: "正在合成 MV" }
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
    audioUrlBackendOnly: null, // #144 — file:// audio URL split-state
    videoUrl: null,
    videoDurSecs: 0, // #132 — used by Hybrid segment planner
    subtitlesSrt: null,
    // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
    // Per-line timing from music engine. null = engine didn't emit alignment;
    // subtitles falls back to even-divide (no regression).
    alignedLyrics: null,
    // CSSOS_PHASE2_PHASE2 20260426 #148-A2/B/E
    // Structured lyric sections + per-section shot scripts + per-section
    // video segments. All null when LLM doesn't emit them; pipeline falls
    // back to single-clip behavior with no regression.
    lyricSections: null,
    shotScripts: null,
    videoSegments: null,
    mvUrl: null,
    duration: 0,
    costs: {},
    engines: {}, // per-stage { engine, version, provider_model?, cost_cents, input_tokens?, output_tokens? }
    running: false,
    stageState: {},
    progress: {},
    // CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
    // "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复
    //  的作品。系统必须自动做这一步，不能让用户手动添加，而是自动添加。"
    // Track which mv_id we've already POST'd to /api/mv/commit so the auto-save
    // wired to compose-done only fires once per finished MV. Both `runAll`
    // re-entries on the same mvId AND any residual manual triggers are no-ops.
    committedMvId: ""
  };

  // CSSOS_PHASE2_DUAL_TRACK 20260430 #229 — Jing
  // "媒体框右上角的♪1 ♪2不显示了。请修复。用户切换到哪首（对）歌,
  //  就播放哪首（对）歌."
  //
  // Set up a TOP-LEVEL switchToTake + cycleLoopMode that operate on
  // whatever pipeline state is currently hydrated. The previous closures
  // were only created inside the music response handler, so a fresh
  // page load + saved-work click had no `__cssosWatchTakeSwitcher`
  // bound, the toggle pill's click handlers silently no-op'd, and the
  // user perceived "♪ 1/♪ 2 disappeared / nothing happens".
  //
  // The music handler will overwrite these bridges with closure-captured
  // versions (line ~3350) once a fresh generation completes — that's
  // fine, the contract is identical: read state.altAudioUrl + state.audioUrl,
  // swap audio source, mute video, sync currentTime, recover from
  // autoplay rejection.
  try {
    // Toggle pill injector — same shape as the closure-bound version
    // hoisted near the music handler. Bound at module init so it's
    // available the first time a saved work is opened (no pipeline run
    // required). Reads through globalThis.__cssosWatchTakeSwitcher so
    // the click handlers stay correct even after the music handler
    // swaps in its closure-bound switcher.
    if (!globalThis.__cssosInjectTakeToggle) {
      globalThis.__cssosInjectTakeToggle = function(opts) {
        const altUrl = String(opts?.altAudioUrl || "").trim();
        const watchScreen =
          document.querySelector(".watch-frame .watch-screen") ||
          document.getElementById("watch-panel");
        if (!watchScreen) return;
        let toggle = document.getElementById("watch-take-toggle");
        if (!altUrl) {
          if (toggle && toggle.parentNode) toggle.parentNode.removeChild(toggle);
          return;
        }
        if (!toggle) {
          toggle = document.createElement("div");
          toggle.id = "watch-take-toggle";
          toggle.style.cssText =
            "position:absolute;top:12px;right:12px;display:flex;gap:4px;" +
            "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
            "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
            "padding:3px;z-index:30;font-size:12px;font-weight:600;letter-spacing:.04em;";
          const mkBtn = (label, take) => {
            const b = document.createElement("button");
            b.type = "button";
            b.dataset.take = String(take);
            b.textContent = label;
            b.style.cssText =
              "background:transparent;color:rgba(255,255,255,0.65);" +
              "border:none;padding:6px 14px;border-radius:999px;" +
              "cursor:pointer;transition:all .15s ease;";
            b.addEventListener("click", () => {
              try {
                const sw = globalThis.__cssosWatchTakeSwitcher;
                if (typeof sw === "function") sw(take);
              } catch (e) { console.warn("[take-toggle]", e); }
            });
            b.addEventListener("contextmenu", (ev) => {
              ev.preventDefault();
              try {
                const cyc = globalThis.__cssosWatchLoopCycler;
                if (typeof cyc === "function") cyc(take);
              } catch (e) { console.warn("[take-loop]", e); }
            });
            return b;
          };
          toggle.appendChild(mkBtn("♪ 1", 1));
          toggle.appendChild(mkBtn("♪ 2", 2));
          watchScreen.style.position = watchScreen.style.position || "relative";
          watchScreen.appendChild(toggle);
        }
        const active = Number(opts?.currentTake || 1);
        toggle.querySelectorAll("button").forEach((b) => {
          const isActive = Number(b.dataset.take) === active;
          b.style.background = isActive ? "rgba(0,245,160,0.25)" : "transparent";
          b.style.color = isActive ? "#00f5a0" : "rgba(255,255,255,0.65)";
        });
      };
    }
    if (!globalThis.__cssosWatchTakeSwitcher) {
      globalThis.__cssosWatchTakeSwitcher = function(take) {
        const url = take === 2 ? state.altAudioUrl : state.audioUrl;
        if (!url) {
          if (typeof globalThis.showToast === "function") {
            const msg = (typeof globalThis.loginCopy === "function")
              ? globalThis.loginCopy(`♪ ${take} unavailable for this work.`,
                                     `♪ ${take} 暂不可用。`)
              : `♪ ${take} unavailable for this work.`;
            globalThis.showToast(msg);
          }
          return;
        }
        state.currentTake = take;
        const audioEl = document.getElementById("watch-audio-preview");
        const videoEl = document.getElementById("watch-video");
        // CSSOS_PHASE2_TAKE_SHARE_VIDEO 20260501 #258 — Jing
        // "歌1，歌2成双成对的时候，播放的画面视频可以不用切换，
        //  只需切换音乐即可。歌1，歌2复用同一个画面同一个视频."
        // Don't swap videoEl.src — Take 1 and Take 2 share the same MP4
        // (only the audio differs). Restart from the start so the user
        // sees the visuals fresh during Take 2 instead of a frozen
        // final frame.
        // CSSOS_PHASE2_TAKE2_AUDIO_FIRST 20260504 — Jing
        // "歌2总是画面/视频播放，声音被静音". Root cause: when an
        // auto-advance fires from videoEl.ended → switchToTake(2),
        // the video.play() at the bottom of this block was firing
        // BEFORE audio.play(). Browser autoplay policy then often
        // rejects audio.play() (the user-activation chain has gone
        // stale post-ended), but since the video already started
        // muted, the user sees motion and assumes "playing" — except
        // the song is silent. Fix: prepare audio FIRST, attempt
        // audio.play() FIRST, and only start video AFTER audio is
        // confirmed playing (or has cleanly attached its play promise).
        // If audio.play() rejects, ALSO pause the video so the visual
        // state matches reality and a single user click resumes both.
        if (audioEl) {
          const sameSrc = audioEl.src && audioEl.src.endsWith(url);
          if (!sameSrc) {
            audioEl.src = url;
            audioEl.load && audioEl.load();
          }
          audioEl.muted = false;
          audioEl.volume = 1;
          try { audioEl.currentTime = 0; } catch (_e) {}
        }
        if (videoEl) {
          try { videoEl.currentTime = 0; } catch (_e) {}
          videoEl.muted = take === 2; // only Take 2 needs video silenced
        }
        const startVideo = () => {
          if (!videoEl || !videoEl.play) return;
          videoEl.play().catch(() => {});
        };
        if (audioEl && audioEl.play) {
          const playPromise = audioEl.play();
          if (playPromise && typeof playPromise.then === "function") {
            playPromise.then(() => {
              // Audio confirmed playing — now release the video so it
              // animates in lockstep.
              startVideo();
            }).catch((err) => {
              console.warn("[take-switch] audio.play() rejected:", err?.name || err);
              // Don't roll the video silently — pause it so the user
              // sees a frozen frame and immediately understands a tap
              // is needed. One click recovers BOTH streams.
              if (videoEl) { try { videoEl.pause(); } catch (_e) {} }
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(`♪ ${take} ready — tap the panel to start.`);
              }
              const recover = () => {
                document.removeEventListener("click", recover, true);
                document.removeEventListener("keydown", recover, true);
                document.removeEventListener("touchstart", recover, true);
                if (audioEl && audioEl.play) {
                  audioEl.play().then(startVideo).catch(() => startVideo());
                } else {
                  startVideo();
                }
              };
              document.addEventListener("click", recover, true);
              document.addEventListener("keydown", recover, true);
              document.addEventListener("touchstart", recover, true);
            });
          } else {
            // Older API: assume sync — start video immediately.
            startVideo();
          }
        } else {
          // No audio element — just start the video.
          startVideo();
        }
        // Refresh toggle pill highlight if injector has rendered it.
        try {
          if (typeof globalThis.__cssosInjectTakeToggle === "function") {
            globalThis.__cssosInjectTakeToggle({
              altAudioUrl: state.altAudioUrl || null,
              currentTake: take,
            });
          }
        } catch (_e) {}
      };
    }
    if (!globalThis.__cssosWatchLoopCycler) {
      globalThis.__cssosWatchLoopCycler = function(_take) {
        // Fallback no-op until music handler binds the closure version.
        // Loop mode mutation requires audio.ended swap logic that lives
        // there; safe to ignore on saved-work playback.
      };
    }
    if (!globalThis.cssosMvPipelinePanelState) {
      globalThis.cssosMvPipelinePanelState = () => state;
    }
  } catch (_e) { /* bridge bootstrap best-effort */ }

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
    // CSSOS_PHASE2_TITLE_NOT_FAILED 20260430 #226 — Jing
    // "标题显示 FAILED 但流程实际成功了 (compose=100%, autosave $0.18)."
    // Root cause: an earlier transient stage error (e.g. cover retry,
    // Stability video API hiccup mid-run) left state.stageState[id]="error"
    // but the pipeline kept going and compose ultimately succeeded. The
    // old logic surfaced ANY error regardless of whether the run later
    // recovered. Now: if compose finished successfully, the run is DONE
    // — past errors are intermediate hiccups, not the final state.
    if (state.stageState && state.stageState.compose === "done") {
      return {
        stageId: "compose",
        label: stageLabel("compose"),
        pct: 100,
        finished: true,
        hasError: false
      };
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
    // CSSOS_PHASE2_LITE_FALLBACK 20260429 #176 — Jing
    // Was 60s default → cut every long song to a 1-min slideshow. Bump
    // to 200s so even when caller can't supply a duration estimate the
    // slideshow has room to play a real song.
    const totalSecs = Number(opts.durationSecs) > 1
      ? Number(opts.durationSecs)
      : 200;
    // Also raise maxSegments so a 226s song actually gets ~20-25 slides
    // (each ~10s) instead of 12 slides × ~19s of awkward Ken Burns.
    const _MAX_SEGMENTS_LITE = 30;
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
    // CSSOS_PHASE2_FACE_DETECT 20260430 #224b — Jing
    // Read the face-detection result from runAll's cover stage if it's
    // ready. None means "use server's (0.5, 0.4) rule-of-thirds default"
    // — caller-side opts.coverFocus override wins for explicit recompose.
    const focus = (opts && opts.coverFocus) || (typeof state !== "undefined" && state ? state.coverFocus : null);
    const focusX = focus && typeof focus.x === "number" ? focus.x : null;
    const focusY = focus && typeof focus.y === "number" ? focus.y : null;

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
          transition_duration_secs: Number(safeT.toFixed(3)),
          // CSSOS_PHASE2_FACE_DETECT 20260430 #224b — only emit when we
          // actually detected a face; otherwise let the backend use its
          // (0.5, 0.4) rule-of-thirds default. Sending null/undefined
          // would force the server to clamp to those defaults anyway,
          // but skipping the field keeps the JSON cleaner in logs.
          ...(focusX != null ? { focus_x: focusX } : {}),
          ...(focusY != null ? { focus_y: focusY } : {})
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
    const targetEachSecs = 10;
    const minSegments = 4;
    const maxSegments = _MAX_SEGMENTS_LITE;
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
        transition_duration_secs: Number(safeT.toFixed(3)),
        // CSSOS_PHASE2_FACE_DETECT 20260430 #224b — Jing
        // Lite slideshow uses one cover for every segment. If face
        // detection landed on this cover, every Ken Burns segment
        // orbits that focus point. Each segment's effect (zoom_in,
        // pan_left, etc.) interacts with the focus differently — the
        // backend's render_kenburns picks the right combo so the face
        // stays in the visible viewport throughout the song.
        ...(focusX != null ? { focus_x: focusX } : {}),
        ...(focusY != null ? { focus_y: focusY } : {})
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

  // CSSOS_PHASE2_FACE_DETECT 20260430 #224b — Jing
  // "前端面部检测，做完真正人脸感知 — 浏览器 FaceDetector API 检测 cover
  //  上的 face bbox，centroid 当 focus_x/focus_y 传给 compose. Chrome/Edge
  //  原生支持，Safari 没有 → 用 (0.5, 0.4) rule-of-thirds 兜底."
  //
  // Deduped per-cover-url cache so a re-run on the same cover doesn't
  // re-detect. Result shape: {x: 0..=1, y: 0..=1} or null.
  const __cssosFaceFocusCache = new Map();
  async function detectCoverFaceFocusOnce(coverUrl) {
    const url = String(coverUrl || "").trim();
    if (!url) return null;
    if (__cssosFaceFocusCache.has(url)) {
      const cached = __cssosFaceFocusCache.get(url);
      if (cached) {
        state.coverFocus = cached;
        console.info(
          "%c[mv-pipeline][face-detect] cached focus → (%s, %s)",
          "color:#08f",
          cached.x.toFixed(3),
          cached.y.toFixed(3)
        );
      }
      return cached;
    }
    // Detect feature availability. window.FaceDetector is the native
    // Shape Detection API (Chrome/Edge stable, behind flag in some
    // versions of Chromium-based browsers).
    if (typeof window.FaceDetector !== "function") {
      console.info(
        "%c[mv-pipeline][face-detect] FaceDetector unavailable in this " +
        "browser — falling back to server's rule-of-thirds (0.5, 0.4). " +
        "Safari/Firefox WASM detector is a follow-up.",
        "color:#888"
      );
      __cssosFaceFocusCache.set(url, null);
      return null;
    }
    try {
      // Load the cover image into an <img> for the detector. Cross-origin
      // covers go through `crossOrigin = "anonymous"` so the detector can
      // read pixel data without CORS errors.
      const img = await new Promise((resolve, reject) => {
        const el = new Image();
        el.crossOrigin = "anonymous";
        el.onload = () => resolve(el);
        el.onerror = () => reject(new Error("image_load_failed"));
        el.src = url;
        // Sanity timeout: 8s.
        setTimeout(() => reject(new Error("image_load_timeout")), 8000);
      });
      const W = img.naturalWidth || img.width;
      const H = img.naturalHeight || img.height;
      if (!W || !H) {
        __cssosFaceFocusCache.set(url, null);
        return null;
      }
      const detector = new window.FaceDetector({
        fastMode: true,
        maxDetectedFaces: 5
      });
      const faces = await detector.detect(img);
      if (!faces || faces.length === 0) {
        console.info(
          "%c[mv-pipeline][face-detect] no faces in cover — using rule-of-thirds default",
          "color:#888"
        );
        __cssosFaceFocusCache.set(url, null);
        return null;
      }
      // Pick the LARGEST face (most likely the main subject). Album
      // covers may have crowd shadows but the foreground person dominates.
      faces.sort((a, b) => {
        const ba = a.boundingBox;
        const bb = b.boundingBox;
        return (bb.width * bb.height) - (ba.width * ba.height);
      });
      const bb = faces[0].boundingBox;
      const cx = (bb.x + bb.width / 2) / W;
      const cy = (bb.y + bb.height / 2) / H;
      // Clamp slightly inward so the viewport never tries to center on
      // the very edge of the cover (zoom_in there would crop into black).
      const focus = {
        x: Math.max(0.18, Math.min(0.82, cx)),
        y: Math.max(0.18, Math.min(0.82, cy))
      };
      __cssosFaceFocusCache.set(url, focus);
      state.coverFocus = focus;
      console.info(
        "%c[mv-pipeline][face-detect] detected %d face(s); largest centroid → (%s, %s) of %dx%d",
        "color:#0a0;font-weight:bold",
        faces.length,
        focus.x.toFixed(3),
        focus.y.toFixed(3),
        W, H
      );
      return focus;
    } catch (err) {
      console.warn("[mv-pipeline][face-detect] detection failed:", err && err.message ? err.message : err);
      __cssosFaceFocusCache.set(url, null);
      return null;
    }
  }
  if (globalThis) {
    globalThis.cssmvDetectCoverFaceFocus = detectCoverFaceFocusOnce;
  }

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
    /* CSSOS_MV_PIPELINE_DRAG_BIND 20260506 — Jing
     * "这个面板无法拖拽…别的面板都可以拖拽，就这个不可以."
     * Root cause: the panel is created HERE at first user interaction —
     * but boot.js had already iterated all .panel elements at startup
     * (when this one didn't exist yet). All bridge attach functions
     * (drag, 8-way resize, panel-bar buttons, focus) idempotently re-bind
     * with a per-element data flag, so calling them again is safe and
     * fixes only the new MV Pipeline panel. */
    try { globalThis.attachPanelDragBridge?.(); } catch (_e) {}
    try { globalThis.attachResizeBridge?.(); } catch (_e) {}
    try { globalThis.attachPanelBarActionsBridge?.(); } catch (_e) {}
    try { globalThis.attachPanelFocusBridge?.(); } catch (_e) {}
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
            /* CSSOS_PHASE3_INLINE_PICKER 20260507 — Jing
             * "每个 stage 行直接 hover ⚙ 选 model → admin 写系统级 / 普通用户写自己". */
            '<span class="mvp-stage-gear" data-stage-gear="' + s.id + '" title="' +
              escapeHtml(copy("Pick engine model", "选择引擎模型")) + '">⚙</span>' +
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
    // CSSOS_PHASE2_CLEAR_INPUTS 20260504 — Jing: a "Clear" companion next
    // to Start Pipeline so users can wipe the prompt/style/lyrics inputs
    // and start a fresh run without refreshing the whole page.
    const clearLabel = copy("Clear", "清除");
    // CSSOS_PHASE2_SURPRISE_ME 20260504 — Jing's "Layer 2 真无限层":
    // the user can ask for an LLM-generated seed (truly unbounded) instead
    // of typing anything. Falls back to the combinatorial seed-bank module
    // (Layer 1, hundreds of millions of unique combos with civilisation
    // bias) if /api/mv/seed is unavailable.
    const surpriseLabel = copy("Surprise me ✨", "随机灵感 ✨");
    // CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
    // Removed the manual "Save as work" button. The auto-save in the
    // compose-done block now POSTs /api/mv/commit exactly once per mv_id, so
    // the user can never click 3× and get 3 duplicates in 作品中心 / 为你创作.
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
          // CSSOS_PHASE2_STYLE_MULTILINE 20260504 — Jing: style was a
          // single-line input which clipped longer style descriptions
          // (e.g. "synth-pop, cinematic, warm, late-night drive,
          // analog-warm, vinyl crackle"). Move to a 2-row textarea so
          // the user can comfortably edit and read multi-tag styles.
          '<textarea id="mvp-style" rows="2" placeholder="' + escapeHtml(stylePlaceholder) + '"></textarea>' +
          '<label>' + escapeHtml(lyricsLabel) + '</label>' +
          '<textarea id="mvp-lyrics" rows="3" placeholder="' + escapeHtml(lyricsPlaceholder) + '"></textarea>' +
          renderAspectRatioControls() +
          /* CSSOS_PHASE3_PARAMS_INLINE 20260507 — extra params moved
           * INTO stage gear dropdowns per Jing. cover gear hosts the
           * count input; video gear hosts hybrid-mix + cinematic-res.
           * Standalone rows removed. */
        '</div>' +
        '<div class="mvp-actions">' +
          '<button id="mvp-run" class="cta">' + escapeHtml(runLabel) + '</button>' +
          '<button id="mvp-surprise" class="cta ghost" type="button" title="LLM-generated, truly random">' + escapeHtml(surpriseLabel) + '</button>' +
          '<button id="mvp-clear" class="cta ghost" type="button">' + escapeHtml(clearLabel) + '</button>' +
          // #147 Save-as-work button removed — auto-save runs on compose-done.
          // CSSOS_PHASE2_MV_TIER_LABEL 20260419 — 常驻 cost label next to
          // the Generate button. Populated by refreshTierCostLabel() once
          // /api/mv/tiers resolves; starts blank so there's no flash of
          // placeholder text. Click to cycle tiers as a v0 picker.
          '<span id="mvp-tier-label" class="mvp-tier-label" role="button" tabindex="0" data-tier-id=""></span>' +
        '</div>' +
        // CSSOS_MV_DAG_WAVE_2_7B 20260507 — ordinary-MV overall progress
        // block (same 5 chips + rainbow bar as cinema hero). Mounted via
        // mountMvOverallProgress() on first run; hidden when not running.
        '<div class="mvp-overall-progress" id="mvp-overall-progress" hidden></div>' +
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

    // CSSOS_PHASE2_MV_PANEL_TIDY 20260505 — Jing
    // "16:9那些按钮全部隐藏，只显示当前选择的规格，再点一下，显示
    //  所有规格". Tap the visible (active) chip to expand the row;
    // picking a different chip auto-collapses. Tapping outside also
    // collapses. CSS hides non-active chips when .is-expanded is
    // absent, so the toggle is purely class-driven.
    if (!row.dataset.cssosCollapseBound) {
      row.dataset.cssosCollapseBound = "1";
      row.addEventListener("click", function (ev) {
        const chip = ev.target.closest(".mvp-aspect-chip");
        if (!chip) {
          // Click on row gutter → toggle expanded state.
          row.classList.toggle("is-expanded");
          return;
        }
        // Was the row collapsed and the user tapped the visible
        // (active) chip? Expand instead of acting on the chip.
        const wasCollapsed = !row.classList.contains("is-expanded");
        if (wasCollapsed && chip.getAttribute("aria-pressed") === "true") {
          row.classList.add("is-expanded");
          ev.preventDefault();
          ev.stopPropagation();
          return;
        }
        // Picking a chip — collapse afterwards.
        setTimeout(function () { row.classList.remove("is-expanded"); }, 0);
      });
      document.addEventListener("pointerdown", function (ev) {
        if (!row.classList.contains("is-expanded")) return;
        if (row.contains(ev.target)) return;
        row.classList.remove("is-expanded");
      }, true);
    }

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
    // CSSOS_PHASE2_CLEAR_INPUTS_AND_STAGES 20260504 — Jing
    // "只清除了上面的输入框，下面的进度条数据也应该都清除吧？为的是让
    //  用户不必刷新整个主界面就可以继续输入新的信息".
    // Wipe the three text inputs AND the six stage cards (cover/lyrics/
    // music/video/subtitles/compose) so the panel returns to a fresh
    // pre-run state. Refuse if a run is in flight — clearing mid-run
    // would orphan the stage state from the still-running pipeline.
    const clearBtn = panel.querySelector("#mvp-clear");
    if (clearBtn) {
      clearBtn.addEventListener("click", function () {
        if (state.running) {
          if (typeof globalThis.showToast === "function") {
            globalThis.showToast(
              "Pipeline is running — please wait for it to finish before clearing."
            );
          }
          return;
        }
        // 1. Wipe inputs
        ["#mvp-prompt", "#mvp-style", "#mvp-lyrics"].forEach(function (sel) {
          const el = panel.querySelector(sel);
          if (el) el.value = "";
        });
        // 2. Reset run-state in memory
        state.title = "";
        state.prompt = "";
        state.style = "";
        state.duration = 0;
        state.altDuration = 0;
        state.coverUrl = "";
        state.audioUrl = "";
        state.altAudioUrl = "";
        state.videoUrl = "";
        state.subtitlesUrl = "";
        state.mvUrl = "";
        state.lyrics = "";
        state.alignedLyrics = null;
        state.shotScripts = null;
        state.sections = null;
        // 3. Reset every stage badge to "idle"
        STAGES.forEach(function (s) { setStage(s.id, "idle", "", 0); });
        // 4. Re-render summary so the cost line clears too
        try { renderSummary(); } catch (_e) {}
        // 5. Reset the watch-panel stage bars (top progress strip)
        try {
          if (typeof globalThis.cssmvStageBarsReset === "function") {
            globalThis.cssmvStageBarsReset();
          }
          if (typeof globalThis.cssmvHideMvArtTitle === "function") {
            globalThis.cssmvHideMvArtTitle();
          }
        } catch (_e) {}
        const promptEl = panel.querySelector("#mvp-prompt");
        if (promptEl) promptEl.focus();
      });
    }
    // CSSOS_PHASE2_SURPRISE_ME 20260504 — fill prompt+style with an
    // LLM-generated (or combinatorial-fallback) seed. Two-layer:
    //   Layer 2: pickLlmSeed() hits POST /api/mv/seed (real LLM call,
    //            truly unbounded). 404 / network → falls through.
    //   Layer 1: pickRandomSeed() composes from civilisation-aware
    //            combinatorial parts (hundreds of millions of unique
    //            combos, festival/season biased).
    const surpriseBtn = panel.querySelector("#mvp-surprise");
    if (surpriseBtn) {
      surpriseBtn.addEventListener("click", async function () {
        const orig = surpriseBtn.textContent;
        surpriseBtn.disabled = true;
        try {
          surpriseBtn.textContent = "…";
          const bank = globalThis.cssmvLocalSeedBank;
          let seed = null;
          if (bank && typeof bank.pickLlmSeed === "function") {
            seed = await bank.pickLlmSeed();
          } else if (bank && typeof bank.pickRandomSeed === "function") {
            seed = bank.pickRandomSeed();
          }
          if (seed && seed.prompt) {
            const promptEl = panel.querySelector("#mvp-prompt");
            const styleEl = panel.querySelector("#mvp-style");
            if (promptEl) promptEl.value = seed.prompt;
            if (styleEl && seed.style) styleEl.value = seed.style;
            // Pulse so the user sees what changed.
            promptEl?.classList.add("mvp-flash");
            styleEl?.classList.add("mvp-flash");
            setTimeout(() => {
              promptEl?.classList.remove("mvp-flash");
              styleEl?.classList.remove("mvp-flash");
            }, 600);
          }
        } finally {
          surpriseBtn.disabled = false;
          surpriseBtn.textContent = orig;
        }
        /* CSSOS_PHASE3_SURPRISE_AUTOSTART 20260507 — Jing
         * "惊喜按钮，点击之后，就不要再让用户点击开始流程按钮，而是直接
         *  触发开始流程按钮". Surprise → seed → immediately fire Start
         * (the same handler #mvp-run uses). */
        try {
          const runBtn = panel.querySelector("#mvp-run");
          if (runBtn && !runBtn.disabled) {
            runBtn.click();
          }
        } catch (_e) { /* best-effort */ }
      });
    }
    // #147: #mvp-save button removed — auto-save runs from compose-done.
    wireAspectRatioControls(panel);
    // CSSOS_PHASE3_INLINE_PICKER 20260507 — gear click opens model
    // dropdown for that stage. Admin → POST /api/admin/engine/default
    // (system-wide); regular user → cookie cssos_<kind>_<provider>_model
    // (personal). The cssosEnginePicker module already handles both
    // — we just delegate to its dropdown opener.
    panel.addEventListener("click", async function (ev) {
      const gear = ev.target?.closest?.("[data-stage-gear]");
      if (!gear) return;
      ev.preventDefault();
      ev.stopPropagation();
      const stageId = gear.getAttribute("data-stage-gear");
      // Resolve current provider/model for this stage from /api/mv/engines
      // catalog cache. cssmvEngines.getSelections() returns the current
      // {engine, version} per stage (default merged with user override).
      const cat = (globalThis.cssmvEngines && typeof globalThis.cssmvEngines.getCatalog === "function")
        ? globalThis.cssmvEngines.getCatalog() : null;
      const stageEntry = cat?.stages?.find?.((x) => x.stage === stageId);
      if (!stageEntry || !Array.isArray(stageEntry.engines) || !stageEntry.engines.length) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(copy("No alternate engines available for this stage", "该 stage 暂无备选引擎"));
        }
        return;
      }
      // Build a tiny inline dropdown anchored to the gear.
      const existing = panel.querySelector(".cssos-stage-pickdown");
      if (existing) existing.remove();
      const dd = document.createElement("div");
      dd.className = "cssos-stage-pickdown";
      const rect = gear.getBoundingClientRect();
      const panelRect = panel.getBoundingClientRect();
      dd.style.cssText =
        "position:absolute;z-index:50;" +
        "top:" + (rect.bottom - panelRect.top + 4) + "px;" +
        "left:" + Math.max(8, rect.left - panelRect.left - 80) + "px;" +
        "min-width:220px;padding:6px;border-radius:10px;" +
        "background:rgba(8,18,16,0.96);" +
        "border:1px solid rgba(0,245,160,0.35);" +
        "box-shadow:0 14px 32px rgba(0,0,0,0.55);" +
        "display:flex;flex-direction:column;gap:2px;";
      /* CSSOS_PHASE3_PARAMS_INLINE 20260507 — Jing
       * Move tier params INTO the stage gear dropdown:
       *   cover gear  → cover-count input on top
       *   video gear  → hybrid-mix slider + cinematic-res select on top
       * Then the engine pick list below (separator between). */
      function makeStageParam(html) {
        const wrap = document.createElement("div");
        wrap.style.cssText = "padding:8px 10px;display:flex;flex-direction:column;gap:6px;border-bottom:1px solid rgba(0,245,160,0.18);margin-bottom:4px;";
        wrap.innerHTML = html;
        return wrap;
      }
      if (stageId === "cover") {
        const wrap = makeStageParam(
          '<label style="font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.65);letter-spacing:.04em;">' +
          escapeHtml(copy("Cover images", "封面图数量")) + '</label>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<input type="number" min="1" max="8" step="1" value="' +
              ((globalThis.localStorage && localStorage.getItem("cssos_mvp_param_cover_count")) || "1") +
              '" id="mvp-stage-cover-count-inline" style="background:rgba(8,18,16,0.55);border:1px solid rgba(0,245,160,0.18);border-radius:6px;padding:4px 8px;color:#daffee;font:600 12px/1 ui-monospace,monospace;width:72px;" />' +
            '<span id="mvp-stage-cover-count-hint" style="font:500 10px/1 ui-monospace,monospace;color:rgba(0,245,160,0.7);">' +
              escapeHtml(copy("max 8 · stays cheaper than Hybrid", "最多 8 张 · 总价低于 Hybrid")) +
            '</span>' +
          '</div>'
        );
        dd.appendChild(wrap);
        const inp = wrap.querySelector("#mvp-stage-cover-count-inline");
        inp.addEventListener("change", function () {
          const v = Math.max(1, Math.min(Number(inp.max || 8), Number(inp.value) || 1));
          inp.value = String(v);
          try { localStorage.setItem("cssos_mvp_param_cover_count", String(v)); } catch (_e) {}
          state.coverCount = v;
        });
      }
      if (stageId === "video") {
        const wrap = makeStageParam(
          '<label style="font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.65);letter-spacing:.04em;">' +
          escapeHtml(copy("Hybrid mix · real video %", "Hybrid 真视频比例")) + '</label>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<input type="range" min="20" max="80" step="5" value="' +
              ((globalThis.localStorage && localStorage.getItem("cssos_mvp_param_hybrid_mix_pct")) || "30") +
              '" id="mvp-stage-hybrid-mix-inline" style="flex:1 1 auto;accent-color:#00f5a0;" />' +
            '<span id="mvp-stage-hybrid-mix-hint" style="font:600 11px/1 ui-monospace,monospace;color:rgba(0,245,160,0.85);min-width:34px;text-align:right;">30%</span>' +
          '</div>' +
          '<label style="font:500 10px/1 ui-monospace,monospace;color:rgba(218,255,238,0.65);letter-spacing:.04em;margin-top:4px;">' +
          escapeHtml(copy("Cinematic resolution", "影院级分辨率")) + '</label>' +
          '<div style="display:flex;align-items:center;gap:8px;">' +
            '<select id="mvp-stage-cinematic-res-inline" style="background:rgba(8,18,16,0.55);border:1px solid rgba(0,245,160,0.18);border-radius:6px;padding:4px 8px;color:#daffee;font:600 12px/1 ui-monospace,monospace;flex:0 0 auto;">' +
              '<option value="720p">720p</option>' +
              '<option value="1080p">1080p</option>' +
              '<option value="4k">4K</option>' +
              '<option value="8k">8K · ' + escapeHtml(copy("preview", "预览")) + '</option>' +
            '</select>' +
            '<span style="font:500 10px/1 ui-monospace,monospace;color:rgba(0,245,160,0.7);">' +
              escapeHtml(copy("Higher = more credits", "越高消耗越多")) +
            '</span>' +
          '</div>'
        );
        dd.appendChild(wrap);
        const slider = wrap.querySelector("#mvp-stage-hybrid-mix-inline");
        const sliderHint = wrap.querySelector("#mvp-stage-hybrid-mix-hint");
        sliderHint.textContent = slider.value + "%";
        slider.addEventListener("input", function () {
          const v = Math.max(20, Math.min(80, Number(slider.value) || 30));
          sliderHint.textContent = v + "%";
          try { localStorage.setItem("cssos_mvp_param_hybrid_mix_pct", String(v)); } catch (_e) {}
          state.hybridMixPct = v;
        });
        const sel = wrap.querySelector("#mvp-stage-cinematic-res-inline");
        try { sel.value = localStorage.getItem("cssos_mvp_param_cinematic_res") || "1080p"; } catch (_e) {}
        sel.addEventListener("change", function () {
          try { localStorage.setItem("cssos_mvp_param_cinematic_res", sel.value); } catch (_e) {}
          state.cinematicRes = sel.value;
        });
      }
      /* CSSOS_PHASE3_DROPDOWN_SORT 20260507 — Jing
       * Default order: time-limited > free > cheap > expensive,
       * with anything OpenAI-branded forced to the bottom regardless
       * of cost. User can toggle to "by usage count" for engines
       * they've picked the most. Usage = local-counter incremented
       * on each click pick (sticks in localStorage). */
      const TIME_LIMITED_ENGINES = new Set([
        "mubert", "kling", "luma", // 30-day / 1-year tokens — burn first
      ]);
      function readUseCount(stage, eng, ver) {
        try { return Number(localStorage.getItem("cssos_engine_count_" + stage + "_" + eng + "_" + ver)) || 0; }
        catch (_e) { return 0; }
      }
      function bumpUseCount(stage, eng, ver) {
        try {
          const k = "cssos_engine_count_" + stage + "_" + eng + "_" + ver;
          localStorage.setItem(k, String(readUseCount(stage, eng, ver) + 1));
        } catch (_e) {}
      }
      function readSortMode() {
        try { return localStorage.getItem("cssos_engine_sort_mode") || "tier"; }
        catch (_e) { return "tier"; }
      }
      function writeSortMode(m) {
        try { localStorage.setItem("cssos_engine_sort_mode", m); } catch (_e) {}
      }
      function priceOf(eng) {
        return Number(eng?.price?.base_price_usd ?? eng?.cost_cents ? Number(eng.cost_cents) / 100 : 0.99);
      }
      function tierRank(eng) {
        const id = String(eng.engine || "").toLowerCase();
        if (id.startsWith("openai")) return 99; // always bottom
        if (TIME_LIMITED_ENGINES.has(id)) return 0; // burn first
        const p = priceOf(eng);
        if (p === 0) return 1;        // free tier
        if (p < 0.05) return 2;       // cheap
        if (p < 0.20) return 3;       // mid
        return 4;                     // expensive
      }
      function sortEngines(list, mode) {
        const arr = [...list];
        if (mode === "usage") {
          arr.sort(function (a, b) {
            const ua = readUseCount(stageId, a.engine || a.id || "", a.version || "");
            const ub = readUseCount(stageId, b.engine || b.id || "", b.version || "");
            if (ub !== ua) return ub - ua;
            return tierRank(a) - tierRank(b);
          });
        } else {
          arr.sort(function (a, b) {
            const ta = tierRank(a), tb = tierRank(b);
            if (ta !== tb) return ta - tb;
            return priceOf(a) - priceOf(b);
          });
        }
        return arr;
      }
      const sortToggle = document.createElement("div");
      sortToggle.style.cssText = "display:flex;justify-content:flex-end;padding:4px 8px 0;gap:8px;";
      const sortLabel = document.createElement("button");
      sortLabel.type = "button";
      sortLabel.style.cssText = "all:unset;cursor:pointer;font:500 9px/1 ui-monospace,monospace;color:rgba(0,245,160,0.7);letter-spacing:.04em;";
      function refreshSortLabel() {
        sortLabel.textContent = readSortMode() === "usage"
          ? copy("sort: ↑ usage", "排序：使用次数")
          : copy("sort: free → paid", "排序：免费→付费");
      }
      refreshSortLabel();
      sortLabel.addEventListener("click", function () {
        writeSortMode(readSortMode() === "usage" ? "tier" : "usage");
        refreshSortLabel();
        // Reorder existing children — strip everything below the sortToggle
        // and re-append in the new order.
        const items = Array.from(dd.querySelectorAll("[data-engine-item]"));
        items.forEach(function (n) { n.remove(); });
        renderEngineItems();
      });
      sortToggle.appendChild(sortLabel);
      dd.appendChild(sortToggle);
      function renderEngineItems() {
        const sorted = sortEngines(stageEntry.engines, readSortMode());
        sorted.forEach(function (eng) { renderOne(eng); });
      }
      function renderOne(eng) {
        const engineId = String(eng.engine || eng.id || eng.name || "?");
        const versionId = String(eng.version || eng.default_version || "default");
        const useCount = readUseCount(stageId, engineId, versionId);
        const item = document.createElement("button");
        item.type = "button";
        item.dataset.engineItem = "1";
        item.style.cssText =
          "all:unset;cursor:pointer;padding:7px 10px;border-radius:6px;" +
          "font:600 12px/1.1 ui-monospace,monospace;color:#daffee;" +
          "display:flex;align-items:center;justify-content:space-between;gap:10px;";
        const left = document.createElement("span");
        left.textContent = engineId + " · " + versionId;
        const right = document.createElement("span");
        right.style.cssText = "font:500 10px/1 ui-monospace,monospace;color:rgba(0,245,160,0.55);min-width:32px;text-align:right;";
        right.textContent = useCount > 0 ? ("× " + useCount) : "";
        item.appendChild(left);
        item.appendChild(right);
        item.addEventListener("mouseenter", function () { item.style.background = "rgba(0,245,160,0.14)"; });
        item.addEventListener("mouseleave", function () { item.style.background = ""; });
        item.addEventListener("click", function () {
          bumpUseCount(stageId, engineId, versionId);
          try {
            if (globalThis.cssmvEngines && typeof globalThis.cssmvEngines.setSelection === "function") {
              globalThis.cssmvEngines.setSelection(stageId, engineId, versionId);
            }
          } catch (_e) {}
          try {
            const isAdmin = String((globalThis.authState?.tier || globalThis.authState?.role || "")).toLowerCase() === "admin";
            if (isAdmin) {
              fetch("/api/admin/engine/default", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ kind: stageId, provider: engineId, model: versionId }),
              }).catch(function () {});
            }
          } catch (_e) {}
          const lbl = panel.querySelector("[data-engine-for='" + stageId + "']");
          if (lbl) lbl.textContent = engineId + "/" + versionId;
          dd.remove();
        });
        dd.appendChild(item);
      }
      renderEngineItems();
      // Skip the legacy un-sorted forEach below.
      const SKIP_LEGACY_RENDER = true;
      if (SKIP_LEGACY_RENDER) {
        const closer2 = function (e) {
          if (!dd.contains(e.target) && e.target !== gear) {
            dd.remove();
            document.removeEventListener("mousedown", closer2, true);
          }
        };
        setTimeout(function () { document.addEventListener("mousedown", closer2, true); }, 0);
        panel.appendChild(dd);
        return;
      }
      // Engine pick list — engines[] is a flat list of {engine, version}
      // pairs from the catalog. Real labels surface as "engine · version".
      stageEntry.engines.forEach(function (eng) {
        const engineId = String(eng.engine || eng.id || eng.name || "?");
        const versionId = String(eng.version || eng.default_version || "default");
        const item = document.createElement("button");
        item.type = "button";
        item.textContent = engineId + " · " + versionId;
        item.style.cssText =
          "all:unset;cursor:pointer;padding:7px 10px;border-radius:6px;" +
          "font:600 12px/1.1 ui-monospace,monospace;color:#daffee;text-align:left;";
        item.addEventListener("mouseenter", function () { item.style.background = "rgba(0,245,160,0.14)"; });
        item.addEventListener("mouseleave", function () { item.style.background = ""; });
        item.addEventListener("click", function () {
          try {
            if (globalThis.cssmvEngines && typeof globalThis.cssmvEngines.setSelection === "function") {
              globalThis.cssmvEngines.setSelection(stageId, engineId, versionId);
            }
          } catch (_e) {}
          try {
            const isAdmin = String((globalThis.authState?.tier || globalThis.authState?.role || "")).toLowerCase() === "admin";
            if (isAdmin) {
              fetch("/api/admin/engine/default", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json", Accept: "application/json" },
                body: JSON.stringify({ kind: stageId, provider: engineId, model: versionId }),
              }).catch(function () {});
            }
          } catch (_e) {}
          const lbl = panel.querySelector("[data-engine-for='" + stageId + "']");
          if (lbl) lbl.textContent = engineId + "/" + versionId;
          dd.remove();
        });
        dd.appendChild(item);
      });
      // Close on outside click.
      const closer = function (e) {
        if (!dd.contains(e.target) && e.target !== gear) {
          dd.remove();
          document.removeEventListener("mousedown", closer, true);
        }
      };
      setTimeout(function () { document.addEventListener("mousedown", closer, true); }, 0);
      panel.appendChild(dd);
    });

    /* CSSOS_PHASE3_PARAMS_INLINE 20260507 — params now live INSIDE the
     * cover/video stage gear dropdowns (see hover ⚙ click handler).
     * Hydrate state from localStorage on mount so runAll() sees them
     * even if user never opens the gear. */
    try {
      state.coverCount = Number(localStorage.getItem("cssos_mvp_param_cover_count")) || 1;
      state.hybridMixPct = Number(localStorage.getItem("cssos_mvp_param_hybrid_mix_pct")) || 30;
      state.cinematicRes = localStorage.getItem("cssos_mvp_param_cinematic_res") || "1080p";
    } catch (_e) {}
    // CSSOS_MV_DAG_WAVE_2_7B_RESUME 20260507 — try restoring an unfinished
    // run for the active person (cinema mode) so a refresh picks up where
    // it left off without forcing the user to re-enter everything.
    try {
      const personId = globalThis.cssmvCurrentPersonId
        || (globalThis.cinemaSt && globalThis.cinemaSt.personId)
        || null;
      const saved = personId ? loadResumeState(personId) : null;
      if (saved) {
        state.runId = saved.runId || state.runId;
        state.mvId = saved.mvId || state.mvId;
        if (saved.prompt && !state.prompt) state.prompt = saved.prompt;
        if (saved.style && !state.style) state.style = saved.style;
        if (saved.title && !state.title) state.title = saved.title;
        if (saved.lyrics && !state.lyrics) state.lyrics = saved.lyrics;
        if (saved.coverUrl) state.coverUrl = saved.coverUrl;
        if (saved.audioUrl) state.audioUrl = saved.audioUrl;
        if (saved.videoUrl) state.videoUrl = saved.videoUrl;
        if (saved.subtitlesSrt) state.subtitlesSrt = saved.subtitlesSrt;
        if (saved.shotScripts) state.shotScripts = saved.shotScripts;
        if (saved.duration) state.duration = saved.duration;
        if (saved.personId) state.personId = saved.personId;
        state._resumeCompleted = Array.isArray(saved.completedStages) ? saved.completedStages.slice() : [];
        // Mark prior stages as done so the UI reflects restored progress.
        try {
          state._resumeCompleted.forEach(function (sid) {
            if (state.stageState) state.stageState[sid] = "done";
          });
        } catch (_e2) {}
        console.info("%c[mv-pipeline][resume] restored unfinished run for person " + personId,
          "color:#0a8;font-weight:bold");
        // CSSOS_MV_DAG_WAVE_2_7C_RESUME_BANNER 20260507 — broadcast so the
        // cinema/panel UI can show "已恢复 X 阶段进度，继续生成…".
        try {
          window.dispatchEvent(new CustomEvent("cssmv:resume-detected", {
            detail: {
              stages: state._resumeCompleted.slice(),
              personId: personId,
              runId: state.runId || ""
            }
          }));
        } catch (_evtErr) { /* non-fatal */ }
      }
    } catch (_resumeErr) { /* non-fatal */ }
    // CSSOS_PHASE2_MV_PANEL_TIDY 20260505 — Jing
    // "进度条们，全部隐藏，留个按钮显示就行". Stages are hidden by
    // default; tap the summary banner to reveal the per-stage rows.
    try {
      const stages = panel.querySelector(".mvp-stages");
      if (stages && !stages.dataset.cssosCollapseBound) {
        stages.dataset.cssosCollapseBound = "1";
        // Initial summary string — refreshed on every stage update.
        if (!stages.dataset.statusSummary) {
          stages.dataset.statusSummary = "Pipeline · ready";
        }
        stages.addEventListener("click", function (ev) {
          // Only toggle when clicking the banner area, not when
          // clicking a stage row inside.
          if (ev.target.closest(".mvp-stage")) return;
          stages.classList.toggle("is-expanded");
        });
      }
    } catch (_e) { /* non-fatal */ }
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

  // CSSOS_MV_DAG_WAVE_2_7B_RESUME 20260507 — Jing
  // "6流程如果因为某些因素而退出/中断/刷新，请保存进度". Persist key
  // pipeline state to localStorage after each stage so that a refresh
  // before compose finishes can pick up where it left off.
  const RESUME_TTL_MS = 24 * 60 * 60 * 1000;
  function resumeKey(state) {
    if (!state) return "";
    if (state.personId) return "cssos_mvp_resume_person_" + String(state.personId);
    const id = state.runId || state.mvId || state.taskId || "default";
    return "cssos_mvp_resume_" + String(id);
  }
  function persistResumeState(state, justCompletedStage) {
    try {
      const key = resumeKey(state);
      if (!key) return;
      const completed = Array.isArray(state._resumeCompleted)
        ? state._resumeCompleted.slice()
        : [];
      if (justCompletedStage && completed.indexOf(justCompletedStage) < 0) {
        completed.push(justCompletedStage);
      }
      state._resumeCompleted = completed;
      const payload = {
        runId: state.runId || null,
        mvId: state.mvId || null,
        prompt: state.prompt || "",
        style: state.style || "",
        title: state.title || "",
        lyrics: state.lyrics || "",
        coverUrl: state.coverUrl || "",
        audioUrl: state.audioUrl || "",
        videoUrl: state.videoUrl || "",
        subtitlesSrt: state.subtitlesSrt || "",
        shotScripts: state.shotScripts || null,
        duration: state.duration || 0,
        personId: state.personId || null,
        completedStages: completed,
        savedAt: Date.now()
      };
      localStorage.setItem(key, JSON.stringify(payload));
    } catch (_e) { /* non-fatal */ }
  }
  function clearResumeState(state) {
    try {
      const key = resumeKey(state);
      if (key) localStorage.removeItem(key);
      if (state) state._resumeCompleted = [];
    } catch (_e) {}
  }
  function loadResumeState(personId) {
    try {
      const key = personId
        ? "cssos_mvp_resume_person_" + String(personId)
        : null;
      if (!key) return null;
      const raw = localStorage.getItem(key);
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== "object") return null;
      if (!obj.savedAt || (Date.now() - Number(obj.savedAt)) > RESUME_TTL_MS) {
        try { localStorage.removeItem(key); } catch (_e) {}
        return null;
      }
      const done = Array.isArray(obj.completedStages) ? obj.completedStages : [];
      if (done.indexOf("compose") >= 0) {
        try { localStorage.removeItem(key); } catch (_e) {}
        return null;
      }
      return obj;
    } catch (_e) { return null; }
  }
  try {
    globalThis.cssmvLoadResume = loadResumeState;
    globalThis.cssmvClearResume = clearResumeState;
  } catch (_e) {}

  // CSSOS_MV_DAG_WAVE_2_7B 20260507 — Jing
  // Shared MV-progress block: 5 stage chips + rainbow bar + percentage,
  // listening to `cssos:run_progress`. Used by both the ordinary MV
  // PIPELINE panel and (in the future) cinema mode. Today cinema still
  // owns its own copy in renderCinemaHeroLoading() — see migration TODO.
  function mountMvOverallProgress(host) {
    if (!host) return;
    if (host.dataset && host.dataset.cssosOverallMounted) return;
    if (host.dataset) host.dataset.cssosOverallMounted = "1";
    const STAGE_META = [
      { id: "lyrics",   weight: 5,  icon: "✍️", label: "Lyrics" },
      { id: "music",    weight: 35, icon: "🎵", label: "Music" },
      { id: "cover",    weight: 10, icon: "🖼️", label: "Cover" },
      { id: "video",    weight: 40, icon: "🎬", label: "Video" },
      { id: "compose",  weight: 10, icon: "🎞️", label: "Compose" }
    ];
    host.innerHTML =
      '<div class="cinema-hero-progress" data-mvp-progress>' +
        '<div class="cinema-hero-progress-stages" data-mvp-progress-stages></div>' +
        '<div class="cinema-hero-progress-bar"><div class="cinema-hero-progress-fill" data-mvp-progress-fill></div></div>' +
        '<div class="cinema-hero-progress-pct" data-mvp-progress-pct>0%</div>' +
      '</div>';
    const stagesEl = host.querySelector("[data-mvp-progress-stages]");
    const fillEl = host.querySelector("[data-mvp-progress-fill]");
    const pctEl = host.querySelector("[data-mvp-progress-pct]");
    let lastPcts = { lyrics: 0, music: 0, cover: 0, video: 0, compose: 0 };
    const renderChips = function (pcts) {
      if (!stagesEl) return;
      stagesEl.innerHTML = STAGE_META.map(function (s) {
        const p = Math.max(0, Math.min(100, Math.round(pcts[s.id] || 0)));
        const tag = p >= 100 ? "✓" : (p > 0 ? (p + "%") : "…");
        const cls = p >= 100 ? "done" : (p > 0 ? "active" : "pending");
        return '<span class="cinema-hero-progress-chip ' + cls + '">' +
          s.icon + " " + s.label + " " + tag + "</span>";
      }).join("");
      try {
        const a = stagesEl.querySelector(".cinema-hero-progress-chip.active");
        if (a && typeof a.scrollIntoView === "function") {
          a.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        }
      } catch (_e) {}
    };
    const compute = function (pcts) {
      let total = 0, denom = 0;
      for (let i = 0; i < STAGE_META.length; i++) {
        const s = STAGE_META[i];
        const p = Math.max(0, Math.min(100, Number(pcts[s.id] || 0)));
        total += (p / 100) * s.weight;
        denom += s.weight;
      }
      return denom ? Math.round((total / denom) * 100) : 0;
    };
    const onProgress = function (ev) {
      try {
        const pr = ev && ev.detail && ev.detail.progress;
        if (!pr) return;
        const composePct = (pr.compose != null) ? pr.compose : (pr.subtitles != null ? pr.subtitles : (pr.kara || 0));
        lastPcts = {
          lyrics: Number(pr.lyrics || 0),
          music: Number(pr.music || 0),
          cover: Number(pr.cover || 0),
          video: Number(pr.video || 0),
          compose: Number(composePct || 0),
        };
        const overall = compute(lastPcts);
        if (fillEl) fillEl.style.width = overall + "%";
        if (pctEl) pctEl.textContent = overall + "%";
        renderChips(lastPcts);
      } catch (_e) {}
    };
    try { window.addEventListener("cssos:run_progress", onProgress); } catch (_e) {}
    renderChips(lastPcts);
  }
  // Expose for cinema migration / external callers.
  try { globalThis.cssmvMountOverallProgress = mountMvOverallProgress; } catch (_e) {}

  function showMvOverallProgress(visible) {
    try {
      const panel = document.getElementById(PANEL_ID);
      const host = panel && panel.querySelector("#mvp-overall-progress");
      if (!host) return;
      host.hidden = !visible;
      if (visible) mountMvOverallProgress(host);
    } catch (_e) {}
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
    else if (newState === "error") failStageProgress(id, detail);
    else if (newState === "idle") resetStageProgress(id);
    // CSSOS_MV_DAG_WAVE_2_7B_RESUME — persist on each stage completion
    // so a mid-run refresh can resume. Compose-done clears the key.
    try {
      if (newState === "done") {
        if (id === "compose") clearResumeState(state);
        else persistResumeState(state, id);
      }
    } catch (_e) { /* non-fatal */ }
    renderSummary();
    // CSSOS_PHASE2_NOTIF_PROGRESS_BROADCAST 20260429 #168.6 — Jing
    // "通知面板进度条卡死 — mv-pipeline 状态没 sync 到 notifications panel"
    // Notifications-panel listens to `cssos:run_progress` events that
    // legacy watch-audio-polling used to fire. Now that MV Pipeline owns
    // the run, that path is gated off and no events are dispatched, so
    // the notification card stays frozen at lyrics-only-100%. Emit the
    // SAME shape from mv-pipeline so the notification bars (and Watch
    // title bar via the same listener) live-update from this stage.
    try {
      const stagePct = (sid) => {
        const stState = state.stageState[sid];
        if (stState === "done") return 100;
        const p = state.progress[sid];
        if (p && Number.isFinite(p.pct)) return Math.round(p.pct);
        return 0;
      };
      const cover_p = stagePct("cover");
      const lyrics_p = stagePct("lyrics");
      const music_p = stagePct("music");
      const video_p = stagePct("video");
      const subtitles_p = stagePct("subtitles");
      const compose_p = stagePct("compose");
      const runId = state.runId || state.taskId || `mv-${state.startedAt || Date.now()}`;
      window.dispatchEvent(new CustomEvent("cssos:run_progress", {
        detail: {
          run_id: runId,
          title: String(state.title || "").trim(),
          stage_label: `Cover ${cover_p}% · Lyrics ${lyrics_p}% · Music ${music_p}% · Video ${video_p}% · Subs ${subtitles_p}% · Compose ${compose_p}%`,
          progress: {
            cover: cover_p,
            lyrics: lyrics_p,
            music: music_p,
            video: video_p,
            subtitles: subtitles_p,
            compose: compose_p,
            kara: compose_p,
          },
          source: "mv-pipeline-panel"
        }
      }));
    } catch (_broadcastErr) { /* non-fatal */ }
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
    // CSSOS_PHASE2_TITLE_BAR_TICK 20260426 #140 — Jing
    // Every progress tick, kick the Watch panel title rotator so the
    // bar bar text updates in lockstep with the MV Pipeline panel's
    // own progress bar instead of staying frozen.
    try {
      if (typeof globalThis.syncWatchProgressRotatorModule === "function") {
        globalThis.syncWatchProgressRotatorModule();
      }
    } catch (_e) { /* non-fatal */ }
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
    // CSSOS_PHASE2_NO_99_TRAP 20260429 #196 — Jing
    // "无法播放，旧卡在99%". Old asymptote climbed to 99.5% and looked
    // like a hard stall while the engine was still actually busy. Cap
    // visually at 96% so a long-running job clearly reads as "still
    // rendering" rather than "100% done but UI broken". The real jump
    // to 100% only happens when the API actually returns successfully
    // and completeStageProgress sets p.pct = 100 explicitly.
    let eased;
    if (tSecs <= p.etaSecs) {
      eased = 92 * (1 - Math.exp(-tSecs / p.etaSecs));
    } else {
      const extraT = tSecs - p.etaSecs;
      // From 92% creep slowly toward the 96% ceiling over 5 × etaSecs.
      eased = 92 + 4.0 * (1 - Math.exp(-extraT / (p.etaSecs * 5)));
    }
    p.pct = Math.min(96, Math.max(p.pct, eased));
    renderProgress(id);
    // Mirror pipeline progress into the Watch panel's 6 border-chase slots.
    try {
      if (typeof globalThis.cssmvStageBarsSetProgress === "function") {
        globalThis.cssmvStageBarsSetProgress(watchBarKeyForStage(id), p.pct);
      }
    } catch (_err) { /* non-fatal */ }
    // CSSOS_PHASE2_NOTIF_PROGRESS_TICK 20260429 #168.6 — Jing
    // Broadcast live progress to notifications panel + Watch title bar
    // (both listen to `cssos:run_progress`). Rate-limited to once per
    // 800 ms so we don't storm the event bus when 6 stages all tick at
    // 250 ms intervals.
    try {
      const NOTIF_THROTTLE_MS = 800;
      const _now = Date.now();
      if (!state.__lastNotifBroadcastAt || (_now - state.__lastNotifBroadcastAt) >= NOTIF_THROTTLE_MS) {
        state.__lastNotifBroadcastAt = _now;
        const stagePct = (sid) => {
          const stState = state.stageState[sid];
          if (stState === "done") return 100;
          const sp = state.progress[sid];
          if (sp && Number.isFinite(sp.pct)) return Math.round(sp.pct);
          return 0;
        };
        const cover_p = stagePct("cover");
        const lyrics_p = stagePct("lyrics");
        const music_p = stagePct("music");
        const video_p = stagePct("video");
        const subtitles_p = stagePct("subtitles");
        const compose_p = stagePct("compose");
        const runId = state.runId || state.taskId || `mv-${state.startedAt || Date.now()}`;
        window.dispatchEvent(new CustomEvent("cssos:run_progress", {
          detail: {
            run_id: runId,
            title: String(state.title || "").trim(),
            stage_label: `Cover ${cover_p}% · Lyrics ${lyrics_p}% · Music ${music_p}% · Video ${video_p}% · Subs ${subtitles_p}% · Compose ${compose_p}%`,
            progress: {
              cover: cover_p,
              lyrics: lyrics_p,
              music: music_p,
              video: video_p,
              subtitles: subtitles_p,
              compose: compose_p,
              kara: compose_p,
            },
            source: "mv-pipeline-tick"
          }
        }));
      }
    } catch (_e) { /* non-fatal */ }
  }

  function completeStageProgress(id) {
    // CSSOS_PHASE2_FORCE_DONE 20260429 #196 — Jing
    // "无法播放，旧卡在99%". Belt-and-suspenders: kill the tick interval,
    // force pct=100, render twice, and broadcast a final progress event
    // so the Watch title bar + notifications panel + border-ring all
    // snap to 100% in lockstep.
    let p = state.progress[id];
    if (!p) {
      // Even if state.progress[id] never got initialized, broadcast the
      // 100% completion so listeners can finalize their UI.
      try {
        const cover_p = id === "cover" ? 100 : (state.stageState.cover === "done" ? 100 : 0);
        const lyrics_p = id === "lyrics" ? 100 : (state.stageState.lyrics === "done" ? 100 : 0);
        const music_p = id === "music" ? 100 : (state.stageState.music === "done" ? 100 : 0);
        const video_p = id === "video" ? 100 : (state.stageState.video === "done" ? 100 : 0);
        const subtitles_p = id === "subtitles" ? 100 : (state.stageState.subtitles === "done" ? 100 : 0);
        const compose_p = id === "compose" ? 100 : (state.stageState.compose === "done" ? 100 : 0);
        window.dispatchEvent(new CustomEvent("cssos:run_progress", {
          detail: {
            run_id: state.runId || state.taskId || "",
            title: state.title || "",
            progress: { cover: cover_p, lyrics: lyrics_p, music: music_p, video: video_p, subtitles: subtitles_p, compose: compose_p, kara: compose_p },
            source: "mv-pipeline-panel-complete"
          }
        }));
      } catch (_e) { /* non-fatal */ }
      showProgress(id, false);
      return;
    }
    stopStageProgress(id);
    p.pct = 100;
    p.finished = true;
    renderProgress(id);
    // Mirror to Watch border-ring immediately so it never lags behind.
    try {
      if (typeof globalThis.cssmvStageBarsSetProgress === "function") {
        globalThis.cssmvStageBarsSetProgress(watchBarKeyForStage(id), 100);
      }
    } catch (_err) { /* non-fatal */ }
    // Broadcast cssos:run_progress with the freshly-100%'d stage so the
    // Watch title bar + notifications card snap up in lockstep.
    try {
      const stagePct = (sid) => {
        const stState = state.stageState[sid];
        if (stState === "done" || sid === id) return 100;
        const sp = state.progress[sid];
        if (sp && Number.isFinite(sp.pct)) return Math.round(sp.pct);
        return 0;
      };
      window.dispatchEvent(new CustomEvent("cssos:run_progress", {
        detail: {
          run_id: state.runId || state.taskId || "",
          title: String(state.title || "").trim(),
          progress: {
            cover: stagePct("cover"),
            lyrics: stagePct("lyrics"),
            music: stagePct("music"),
            video: stagePct("video"),
            subtitles: stagePct("subtitles"),
            compose: stagePct("compose"),
            kara: stagePct("compose"),
          },
          source: "mv-pipeline-panel-complete"
        }
      }));
    } catch (_e) { /* non-fatal */ }
    setTimeout(function () {
      if (state.stageState[id] === "done") showProgress(id, false);
    }, 500);
    // CSSOS_PHASE2_AUTOPLAY_ON_COMPOSE_DONE 20260429 #197 — Jing
    // "API 返回的瞬间，强制 setStage 同步把 timer 杀掉 + bar=100%，
    //  并自动启动 MV 自动播放".
    // Belt-and-suspenders: even if the subsequent autoplay block in
    // the runAll() compose-done path skips for any reason (race,
    // exception, timing), this safety net opens Watch + plays the
    // freshly-rendered MV the moment compose hits 100%.
    if (id === "compose" && state.mvUrl) {
      try {
        const watchPanel = document.getElementById("watch-panel");
        if (watchPanel) {
          if (typeof globalThis.openWatchPreviewShellModule === "function") {
            globalThis.openWatchPreviewShellModule({ fallbackTab: "mv" });
          } else {
            watchPanel.classList.remove("hidden");
            watchPanel.dataset.minimized = "false";
          }
          if (watchPanel.dataset.maximized !== "true") {
            if (typeof globalThis.openAndMaximize === "function") {
              globalThis.openAndMaximize(watchPanel);
            } else if (typeof globalThis.togglePanelMaximize === "function") {
              globalThis.togglePanelMaximize(watchPanel);
            }
          }
        }
        if (typeof globalThis.setWatchVideoFromArtifact === "function") {
          globalThis.setWatchVideoFromArtifact(state.mvUrl, {
            sourceKind: "mv-pipeline-final"
          });
        }
        if (typeof globalThis.activateWatchTab === "function") {
          globalThis.activateWatchTab("mv");
        }
        if (typeof globalThis.attemptWatchVideoPlaybackModule === "function") {
          globalThis.attemptWatchVideoPlaybackModule({
            allowFallback: true,
            maxRetries: 3
          });
        }
        console.info(
          "%c[mv-pipeline][completeStage] compose=100% → Watch open + autoplay",
          "color:#0c0;font-weight:bold"
        );
      } catch (_autoplayErr) {
        console.warn("[mv-pipeline][completeStage] autoplay safety-net failed:", _autoplayErr);
      }
    }
  }

  function failStageProgress(id, errMsg) {
    const p = state.progress[id];
    stopStageProgress(id);
    if (p) {
      p.finished = true;
      renderProgress(id);
    }
    showProgress(id, true, "error-state", true);
    // CSSOS_PERSON_MV_CINEMA_PROGRESS 20260507 — Jing
    // Surface stage-level failures to cinema-mode loading screen so the
    // user gets a "❌ 失败 · 重试" affordance instead of a forever spinner.
    try {
      globalThis.dispatchEvent(new CustomEvent("cssmv:stage-error", {
        detail: { stage: id, message: String(errMsg || "") }
      }));
    } catch (_dispatchErr) {}
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
    // #147: #mvp-save button removed — no enable/disable toggle needed.
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
    // CSSOS_PHASE2_TITLE_VALIDATION 20260430 #207b — Jing
    // (a) Title is REQUIRED for cssOS (Suno itself treats it as optional;
    //     we mandate it because a missing or generic title degrades Suno's
    //     style/voice priors and produced "Verse 1 demo" outputs).
    // (b) Forbid mixed-language with `/` (e.g. "Mount Hermon Oath / 黑门之誓"):
    //     Suno parses the slash as a multi-track separator and downgrades
    //     the arrangement. Single language only.
    // CSSOS_PHASE2_TITLE_VALIDATION_RELAX 20260430 #207d — Jing
    // "好像还没完整修复" — the MV PIPELINE panel uses #mvp-prompt (the
    // textarea actually visible in this panel), not #title-input or
    // #prompt-input from the global creation flow. Reading those IDs
    // returned blank because they're outside this panel's DOM, so even
    // a filled-in PROMPT/THEME box looked empty. Read from the panel's
    // own #mvp-prompt + #mvp-style first, then fall back to the global
    // state and finally the legacy IDs.
    try {
      const panelPromptEl = document.getElementById("mvp-prompt");
      const panelTitleEl = document.getElementById("mvp-title");
      const panelPromptVal = String(panelPromptEl?.value || "").trim();
      const panelTitleVal = String(panelTitleEl?.value || "").trim();
      const titleField = (
        panelTitleVal ||
        String(state.title || "").trim() ||
        String(document.getElementById("title-input")?.value || "").trim()
      );
      let promptSrc = (
        panelPromptVal ||
        String(state.prompt || "").trim() ||
        String(document.getElementById("prompt-input")?.value || "").trim() ||
        String(opts?.seed?.prompt || "").trim() ||
        String(opts?.seed?.transcript || "").trim()
      );
      // CSSOS_PHASE2_ZERO_INPUT_SEED 20260430 #230 — Jing
      // "万能入口们还是没有走新的流程…MV PIPELINE的进度条们都没有走动."
      // Universal entries (logo / dock-play / right-click 一键MV) often
      // arrive with everything blank because the user hasn't typed
      // anything yet. Synthesise a random prompt+style from the local
      // seed bank so runAll always has something to work with — the
      // pipeline will then ask the LLM for a real title + lyrics. This
      // is "缺啥补啥 + 零输入必须随机" implemented at the validation
      // gate. If the seed bank module isn't loaded we fall back to a
      // small inline pool that always lands on a plausible cssOS prompt.
      if (!titleField && !promptSrc) {
        try {
          const bank = globalThis.cssmvLocalSeedBank || globalThis.__cssmvSeedBank;
          let seeded = null;
          if (bank && typeof bank.pickRandomSeed === "function") {
            seeded = bank.pickRandomSeed();
          }
          if (!seeded) {
            // CSSOS_PHASE2_SEED_POOL_EXPANSION 20260504 — Jing
            // "我已经刷到多少次'穿越四季的旅人和一只老怀表'，就我一个人,
            //  就这么短的时间，就可以这样'随机'到第二次".
            // 6-entry pool → birthday paradox: ~50% collision after 4 picks.
            // Expand to 80+ across multiple genres & languages, plus a
            // localStorage no-repeat-recent guard so the last 16 picks
            // are filtered out before we pick again. Combined with a
            // crypto.getRandomValues seed, this makes back-to-back
            // collisions effectively impossible until the user has
            // exhausted ~80 distinct prompts.
            const inlinePool = [
              // English ballads / pop
              { prompt: "a hopeful synth-pop ballad about chasing the dawn", style: "synth-pop, cinematic, warm" },
              { prompt: "a slow piano elegy for an old friend", style: "piano, melancholic, intimate" },
              { prompt: "a cyber-funk anthem for the after-hours crew", style: "synth-funk, retro, groovy" },
              { prompt: "a midnight indie-folk lullaby for restless dreamers", style: "indie-folk, hushed, candlelit" },
              { prompt: "an arena rock anthem about leaving a small town behind", style: "stadium-rock, anthemic, soaring" },
              { prompt: "a dream-pop confessional under flickering streetlights", style: "dream-pop, reverb, twilight" },
              { prompt: "a hip-hop sketch of a barber shop on a rainy Tuesday", style: "boom-bap, jazzy samples, mellow" },
              { prompt: "a country waltz about an unsent letter to mama", style: "country-folk, fingerpicked, sepia" },
              { prompt: "a disco strut about the last call before sunrise", style: "nu-disco, glittering, tight pocket" },
              { prompt: "a punk shout-along about quitting a soul-crushing job", style: "punk-rock, fast, defiant" },
              { prompt: "a lo-fi study-room loop watching snow on a window", style: "lo-fi hip-hop, vinyl crackle, soft" },
              { prompt: "a future-bass love letter from a satellite to its planet", style: "future-bass, glassy, euphoric" },
              { prompt: "a gospel-choir hymn about the long road home", style: "gospel-soul, hammond organ, fervent" },
              { prompt: "an outlaw country tale of a runaway and an old map", style: "outlaw-country, dusty, baritone" },
              { prompt: "an EDM festival bloom about the moment the drop hits", style: "big-room edm, build-and-release, peak-time" },
              { prompt: "a jazz-noir torch song in a smoke-filled lounge", style: "jazz-noir, brushed drums, sultry" },
              { prompt: "a math-rock puzzle about debugging at 3 a.m.", style: "math-rock, polyrhythmic, bright" },
              { prompt: "a trap ode to the grandmother who raised the block", style: "trap-soul, 808s, reverent" },
              { prompt: "a shoegaze sigh through wet train windows", style: "shoegaze, walls of guitar, bittersweet" },
              { prompt: "a synthwave drive across a neon desert highway", style: "synthwave, retro, propulsive" },
              // Chinese (Mandarin) prompts
              { prompt: "夜风穿过霓虹城市,孤身追寻一盏灯", style: "city-pop, dreamy, mid-tempo" },
              { prompt: "穿越四季的旅人与一只老怀表", style: "folk-rock, narrative, warm" },
              { prompt: "梅雨时节的旧巷子,屋檐下两把伞慢慢靠近", style: "中式民谣, 温柔, 雨声" },
              { prompt: "高铁穿过云海,奶奶手心里那粒糖还没化", style: "新民谣, 思乡, 钢琴主导" },
              { prompt: "凌晨四点的便利店,关东煮和一段未发出的语音", style: "都市抒情, 慵懒电音, 自语" },
              { prompt: "故宫红墙下,猫和落叶争一片夕阳", style: "古风新民乐, 笛箫, 闲适" },
              { prompt: "深圳地铁三号线,一首没听完的歌循环了二十分钟", style: "city-pop, 舒缓, 城市夜归" },
              { prompt: "外卖员的电瓶车,载着一整个小区的晚饭", style: "民谣摇滚, 温暖, 真实" },
              { prompt: "毕业那天教学楼前的大樟树,最后一次合影", style: "校园民谣, 木吉他, 回忆" },
              { prompt: "胡同里大爷的鸽哨,飞过新装的玻璃幕墙", style: "新中式电子, 钹与笙, 时空交错" },
              { prompt: "台风夜的阳台,风铃和母亲的电话同频", style: "氛围流行, 钢琴 + 弦乐, 安然" },
              { prompt: "凉山小卖部老板娘的儿子,考上了北京的大学", style: "民族民谣, 山歌, 真挚" },
              { prompt: "上海老洋房里被一条围巾盖住的老唱机", style: "复古爵士, 黑胶质感, 怀旧" },
              { prompt: "敦煌月牙泉边一支被风吹响的羌笛", style: "新世界音乐, 笛与琵琶, 苍茫" },
              { prompt: "高考前最后一节晚自习的窗外烟花", style: "青春流行, 弦乐推升, 奋进" },
              // Cantonese / Hong Kong vibes
              { prompt: "尖沙咀渡轮上一封没寄出的旧情书", style: "粤语 city-pop, 复古, 海风" },
              { prompt: "茶餐厅卡座的菠萝油与一段未说出口的告白", style: "粤语流行, 钢琴 + 萨克斯, 暖意" },
              // Korean
              { prompt: "한적한 해변에서 들리는 첫사랑의 노래", style: "k-ballad, acoustic, tender" },
              { prompt: "서울 지하철 마지막 칸의 늦은 밤 이어폰", style: "k-r&b, mellow, late-night" },
              { prompt: "할머니의 자개장 위에 놓인 오래된 라디오", style: "k-folk, warm strings, nostalgic" },
              // Japanese
              { prompt: "京都の路地裏、桜が散る前の最後の自転車", style: "j-pop, acoustic, 春" },
              { prompt: "新宿の終電に乗り遅れた二人と一缶の缶コーヒー", style: "city-pop, 80s japan, 夜霧" },
              { prompt: "瀬戸内海のフェリーから見えた朝焼け", style: "j-folk, 弦楽四重奏, 静謐" },
              // Spanish / Portuguese
              { prompt: "una bossa nova en una cafetería de Lisboa al atardecer", style: "bossa-nova, nylon guitar, gentle" },
              { prompt: "una cumbia para bailar en la cocina con la abuela", style: "cumbia, accordion, joyful" },
              { prompt: "uma serenata para quem partiu sem dizer adeus", style: "fado, mournful, voice-forward" },
              { prompt: "un reggaetón suave sobre volver a casa después de años", style: "reggaeton-pop, smooth, dembow-lite" },
              // French
              { prompt: "une chanson sur un café fumant et un journal froissé", style: "chanson, accordéon, mélancolique" },
              { prompt: "un slow électronique pour les nuits sur le périph", style: "french-touch, late night, filtered" },
              // Arabic / Middle Eastern
              { prompt: "أغنية عن قهوة الفجر وصوت الأذان البعيد", style: "arabic-soul, oud + qanun, 黎明" },
              { prompt: "a desert caravan ghazal under a thousand stars", style: "world-fusion, oud, ney, hypnotic" },
              // Hindi / Indian
              { prompt: "मॉनसून की पहली बारिश और छत पर पुरानी छतरी", style: "indian-folk-pop, harmonium, monsoon" },
              { prompt: "a Mumbai local-train romance written in raindrops", style: "fusion, sitar + electronics, monsoon" },
              // Genres / moods less language-bound
              { prompt: "a tango about a watch repairman who lost his pocketwatch", style: "neo-tango, bandoneón, dramatic" },
              { prompt: "an Irish folk reel about the lighthouse keeper's daughter", style: "celtic-folk, fiddle, briny" },
              { prompt: "a string quartet meditation on the first cup of morning tea", style: "neo-classical, chamber, contemplative" },
              { prompt: "a metal anthem about the launch of a tiny rocket from a backyard", style: "power-metal, anthemic, soaring" },
              { prompt: "a children's lullaby for a robot learning to dream", style: "lullaby, music-box, tender" },
              { prompt: "a Saturday-morning bossa about pancakes and old vinyl", style: "bossa-pop, lazy, sun-dappled" },
              { prompt: "a campfire singalong about a fox who hated being alone", style: "acoustic-folk, communal, warm" },
              { prompt: "an ambient wash mapping the weather inside an empty mailbox", style: "ambient, drone, hushed" },
              { prompt: "a bluegrass barn-dance about a tractor named Hope", style: "bluegrass, banjo, foot-stomping" },
              { prompt: "a hyperpop diary entry from a cat with WiFi anxiety", style: "hyperpop, glitchy, playful" },
              { prompt: "a soul ballad about the bus driver who knows everyone", style: "neo-soul, hammond, conversational" },
              { prompt: "a klezmer waltz at a wedding where the cake fell", style: "klezmer, clarinet, joyous-chaotic" },
              { prompt: "a trip-hop monologue from a payphone that still works", style: "trip-hop, dusty samples, late-90s" },
              { prompt: "a Hawaiian slack-key tribute to a grandfather's surfboard", style: "hawaiian-folk, slack-key, sun-warm" },
              { prompt: "a pirate sea-shanty about a parrot who went to college", style: "sea-shanty, communal, jaunty" },
              { prompt: "a stadium ballad about the last home game of the season", style: "arena-pop, anthemic, bittersweet" },
              { prompt: "a film-noir score for a detective afraid of cilantro", style: "cinematic-jazz, brushed drums, comic-noir" }
            ];
            // Avoid the last 16 prompts the user has seen on this device.
            const RECENT_KEY = "cssos_seed_recent";
            const MAX_RECENT = 16;
            let recent = [];
            try {
              recent = JSON.parse(localStorage.getItem(RECENT_KEY) || "[]");
              if (!Array.isArray(recent)) recent = [];
            } catch (_e) { recent = []; }
            const recentSet = new Set(recent);
            const fresh = inlinePool.filter((s) => !recentSet.has(s.prompt));
            const candidates = fresh.length > 0 ? fresh : inlinePool;
            // Use crypto.getRandomValues for a non-Math.random index so
            // back-to-back picks don't share a PRNG seed (mobile Safari
            // re-seeds Math.random per JS context which can produce
            // sequences that feel "sticky").
            let pickIdx = 0;
            if (typeof crypto !== "undefined" && crypto.getRandomValues) {
              const buf = new Uint32Array(1);
              crypto.getRandomValues(buf);
              pickIdx = buf[0] % candidates.length;
            } else {
              pickIdx = Math.floor(Math.random() * candidates.length);
            }
            seeded = candidates[pickIdx];
            // Remember this pick so it's filtered out next time.
            try {
              recent.push(seeded.prompt);
              while (recent.length > MAX_RECENT) recent.shift();
              localStorage.setItem(RECENT_KEY, JSON.stringify(recent));
            } catch (_e) { /* localStorage full or disabled — ignore */ }
            console.info(
              "%c[seed-bank] picked %s/%d (recent-excluded=%d)",
              "color:#0a0", String(seeded.prompt).slice(0, 40) + "…",
              candidates.length, recent.length
            );
          }
          if (seeded?.prompt) {
            promptSrc = String(seeded.prompt).trim();
            // Reflect the synthesized prompt back into the panel so the
            // user sees what we filled in for them.
            const promptEl = document.getElementById("mvp-prompt");
            if (promptEl && !promptEl.value) promptEl.value = promptSrc;
            const styleEl = document.getElementById("mvp-style");
            if (styleEl && !styleEl.value && seeded?.style) {
              styleEl.value = String(seeded.style);
              state.style = String(seeded.style);
            }
            state.prompt = promptSrc;
            console.info("[runAll] synthesized zero-input seed:", seeded);
          }
        } catch (_seedErr) { /* fall through to user-prompt requirement */ }
      }
      const promptHead = promptSrc.split(/\r?\n/)[0].trim();
      // CSSOS_PHASE2_TITLE_EXTRACT 20260504 — Jing
      // "标题，写明是 PROMPT / THEME，也就是提示词或者主题都可以，如果有
      //  明确标题，就不用再提炼标题，可是，这明显是提示词/PROMPT，应该
      //  提炼出一个标题…请不要再把这些 PROMPT 直接当成标题了".
      //
      // The PROMPT/THEME field is for prompts (long instructions) OR
      // titles (short noun phrases). Previously we always used the
      // first line of the prompt as the title — which produced the
      // ridiculous "WATCH · KN是韩国汽车品牌KIA的新LOGO，由于设计得
      // 很古怪，很多人都误以为是KN…" banner. Detect "this is a long
      // instruction, not a title" and extract a short title instead.
      //
      // Strategy: first try cheap heuristics (quoted strings, 以X为题,
      // 关于X, 《X》, the most prominent Latin-letters token). If none
      // match, set state.title to "" so the lyrics-derive step (line
      // ~3225) adopts the LLM-generated title from /api/mv/lyrics
      // response — which is exactly what the design intended.
      const extractTitleFromPrompt = (raw) => {
        const s = String(raw || "").trim();
        if (!s) return "";
        // Short enough to BE a title.
        if ([...s].length <= 24) return s;
        // Quoted strings: "X", 'X', 「X」, 『X』, 《X》
        const quoteRx = /(?:[「『《"'“‘])([^「『《"'“”’》」』]+?)(?:[》」』"'”’])/u;
        const qMatch = s.match(quoteRx);
        if (qMatch && qMatch[1] && [...qMatch[1].trim()].length <= 24) {
          return qMatch[1].trim();
        }
        // Chinese hint: "以X为题" / "关于X的" / "X 之歌"
        const zhTitle = s.match(/以\s*([^，。,?\s]{1,20})\s*为题/) ||
                        s.match(/关于\s*([^，。,?\s]{1,20})\s*的/) ||
                        s.match(/([^，。,?\s]{1,16})\s*之歌/);
        if (zhTitle && zhTitle[1]) return zhTitle[1].trim();
        // CSSOS_PHASE2_NO_ACRONYM_FALLBACK 20260504 — drop the dangerous
        // 2-letter all-caps fallback (was promoting "KN" / "ACT" etc.).
        //
        // CSSOS_PHASE2_NL_PROMPT_TITLE 20260505 — Jing
        // "a trap-soul song about the matchmaker of a small village …
        //  系统随机生成的prompt也要提炼标题". Natural-language seeds
        // (Surprise Me, voice-to-text) typically follow the pattern
        //   "a <genre> song about <subject> who/that/—/at <modifier>"
        // Extract <subject> (the noun phrase right after "about") and
        // tidy it into a title. Capitalise each word, drop trailing
        // articles, cap to ~28 chars / 5 words.
        const titleCase = (str) => str
          .toLowerCase()
          .replace(/\b([a-z])/g, (m) => m.toUpperCase())
          // Lowercase common tiny words mid-phrase: of, the, a, an, in,
          // on, at, and, or, with — but keep them upper-cased at start.
          .replace(/(\s)(Of|The|A|An|In|On|At|And|Or|With|To|For|By|From)\b/g,
                   (_m, p, w) => p + w.toLowerCase())
          .trim();
        const trimSubject = (sub) => {
          let out = String(sub || "").trim();
          // Stop at any clause delimiter that signals "modifier follows".
          out = out.split(/\s+(?:who|that|which|where|when|while|—|–|-)\s+/i)[0].trim();
          // Drop trailing connectors / prepositions.
          out = out.replace(/\s+(of|in|on|at|with|to|for|by|from|and|or)\s*$/i, "");
          // Cap word count to 5 for a tight title.
          const words = out.split(/\s+/).filter(Boolean);
          if (words.length > 5) out = words.slice(0, 5).join(" ");
          // Cap chars at 28.
          if ([...out].length > 28) out = [...out].slice(0, 28).join("").trim();
          return out;
        };
        // Pattern A: "song about <X>" / "ballad about <X>" / "<genre> about <X>"
        const aboutMatch = s.match(/\b(?:song|ballad|tune|track|piece|melody|anthem|chant|hymn|elegy|aria|opus|lullaby|serenade)\s+about\s+(.+?)(?:[.,;:!?]|$)/i)
                       || s.match(/\babout\s+(.+?)(?:[.,;:!?]|$)/i);
        if (aboutMatch && aboutMatch[1]) {
          const sub = trimSubject(aboutMatch[1]);
          if (sub && [...sub].length >= 3) return titleCase(sub);
        }
        // Pattern B: "<X> who/that…" — extract leading noun phrase before relative.
        const relMatch = s.match(/^(?:a|an|the)?\s*(.{4,40}?)\s+(?:who|that|which|where|when)\s+/i);
        if (relMatch && relMatch[1]) {
          const sub = trimSubject(relMatch[1]);
          if (sub && [...sub].length >= 3) return titleCase(sub);
        }
        // First short clause (split on punctuation).
        const firstClause = s.split(/[，。,.?!？！\n;；]/)[0].trim();
        if (firstClause && [...firstClause].length <= 24) return firstClause;
        // Last resort: title-case the first 4 words so we never hand the
        // user the raw prompt as a title.
        const firstWords = s.split(/\s+/).slice(0, 4).join(" ");
        if (firstWords && [...firstWords].length <= 28) return titleCase(firstWords);
        return "";
      };
      // CSSOS_PHASE2_BRACKETED_PROMPT 20260504 — Jing
      // "如果用户输入了 prompt（系统必须智能判断/提炼是长标题，还是
      //  prompt），系统返回提炼后标题，如'KN'，然后旧的 prompt 放在第 2
      //  行 [...] 中括号里".
      //
      // The panel's PROMPT/THEME textarea is now a hybrid widget. Two
      // user-facing forms it can hold:
      //   (a) "<title>\n[<original prompt>]"  — what we rewrite TO once
      //       we've extracted a title from a long prompt.
      //   (b) anything else (single line title OR a fresh long prompt).
      //
      // Re-runs need to recognise form (a) and parse it back into
      // (title=line1, prompt=bracketed-text-without-brackets) without
      // re-bracketing. Detection: line1 short (≤ 24 chars), line2 wrapped
      // in matching [ … ] (allow trailing whitespace).
      let parsedTitleFromBracketForm = "";
      let parsedPromptFromBracketForm = "";
      try {
        const lines = String(panelPromptVal || "").split(/\r?\n/);
        if (lines.length >= 2) {
          const firstLine = lines[0].trim();
          const rest = lines.slice(1).join("\n").trim();
          const bracketRx = /^\[\s*([\s\S]+?)\s*\]\s*$/;
          const bm = rest.match(bracketRx);
          if (firstLine && [...firstLine].length <= 24 && bm && bm[1]) {
            parsedTitleFromBracketForm = firstLine;
            parsedPromptFromBracketForm = bm[1].trim();
          }
        }
      } catch (_e) { /* */ }

      const promptForExtraction = parsedPromptFromBracketForm || promptHead;
      const heuristicTitle =
        titleField ||
        parsedTitleFromBracketForm ||
        extractTitleFromPrompt(promptForExtraction);
      const titleRaw = heuristicTitle;
      if (!titleRaw && !promptForExtraction) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            "Please give your song a title (title field) or a prompt — both are empty."
          );
        }
        try {
          (document.getElementById("mvp-prompt") ||
            document.getElementById("title-input") ||
            document.getElementById("prompt-input"))?.focus();
        } catch (_e) {}
        return;
      }
      // If we DID extract a heuristic title, use it. Otherwise leave
      // state.title empty so the derive-from-lyrics step (line ~3225)
      // adopts the LLM-generated title once /api/mv/lyrics returns.
      if (!titleField) {
        state.title = heuristicTitle || "";
      }
      // The actual prompt text downstream stages should see — strips
      // the bracket wrapper if we parsed form (a); otherwise the raw
      // panel prompt.
      const actualPromptText = parsedPromptFromBracketForm || panelPromptVal;
      if (actualPromptText && state.prompt !== actualPromptText) {
        state.prompt = actualPromptText;
      }
      // Rewrite the mvp-prompt textarea into the "title\n[prompt]" form
      // so the user sees what was extracted vs what was kept as context.
      // Skip when:
      //   • already in bracket form (don't double-bracket)
      //   • no extraction happened (prompt IS a short title)
      //   • user typed an explicit titleField (which won the title slot)
      try {
        const promptEl = document.getElementById("mvp-prompt");
        if (
          promptEl &&
          heuristicTitle &&
          !parsedTitleFromBracketForm &&
          !titleField &&
          actualPromptText &&
          actualPromptText !== heuristicTitle
        ) {
          const formatted = `${heuristicTitle}\n[${actualPromptText}]`;
          promptEl.value = formatted;
          promptEl.classList.add("mvp-flash");
          setTimeout(() => promptEl.classList.remove("mvp-flash"), 600);
        }
      } catch (_e) { /* non-fatal — pipeline still runs */ }
      // CSSOS_PHASE2_TITLE_EXTRACT 20260504 — when we deliberately leave
      // titleRaw empty (long prompt → LLM derives the real title), skip
      // the slash/length/emoji validations. They'll be re-applied to the
      // LLM-generated title in the derive-resp adoption step (line ~3225).
      if (!titleRaw) { /* skip validation; LLM will fill in */ }
      else {
      // CSSOS_PHASE2_DROP_SLASH_GATE 20260504 — Jing
      // "Suno 是可以接受带 / 等特殊字符的多语言标题的，特殊字符，Suno
      //  也会智能过滤（甚至一些敏感字符）。所以，请取消我们狗拿耗子多
      //  管闲事的多语言特殊字符的拦截提示".
      // Removed the over-eager "mixed-language with slash" gate that
      // refused titles like "Mount Hermon Oath / 黑门之誓". Suno
      // handles them fine on its end; trust the upstream.
      // CSSOS_PHASE2_TITLE_LENGTH_EMOJI 20260430 #218 — Jing
      // Suno's `title` field tolerates ~80 chars; longer titles get
      // truncated mid-word and confuse the style hint. Emojis (especially
      // ZWJ sequences like 👨‍👩‍👧) and certain combining marks make Suno's
      // tokenizer emit garbled phonetic guesses ("eee em ojee").
      // Cap to 80 chars and reject standalone emoji-only titles. Allow
      // mixed text+emoji but warn so the user knows what's happening.
      const titleCharCount = [...titleRaw].length;
      if (titleCharCount > 80) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            `Title is ${titleCharCount} chars — Suno truncates at ~80. Please shorten before generating.`
          );
        }
        try { (document.getElementById("title-input") || document.getElementById("prompt-input"))?.focus(); } catch (_e) {}
        return;
      }
      // Strict-emoji detection: pictographic codepoints + variation selectors.
      const emojiRx = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F1E6}-\u{1F1FF}]/u;
      const stripped = titleRaw.replace(new RegExp(emojiRx.source, "gu"), "").trim();
      if (!stripped) {
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(
            "Title is emoji-only — Suno can't pronounce emoji. Please add at least one word."
          );
        }
        try { (document.getElementById("title-input") || document.getElementById("prompt-input"))?.focus(); } catch (_e) {}
        return;
      }
      } // close: else (titleRaw non-empty validation block)
    } catch (_e) { /* validation best-effort */ }
    // CSSOS_PHASE2_KILL_STALE_HARD 20260429 #168.3 + 20260504 — Jing
    // "stale audio kill 不彻底（旧恐怖音效还能播完 5 分钟）— 改 destroy
    //  + recreate audio element + cache-bust src 时间戳"
    //
    // 2026-05-04 update: "MV PIPELINE 走流程的时候，正在播放的媒体是
    //  否可以不用暂停？等新的媒体输出完毕，直接替换正在播放的媒体，
    //  全新播放？" — keep currently-playing media flowing through the
    //  whole pipeline; only swap when new compose-done lands. The
    //  hard-kill stays in place for STALE / FAILED runs (those are the
    //  reason this block was added — old horror audio from a crashed
    //  run would otherwise loop for 5 minutes).
    //
    // Decision rule: if the currently-playing element carries
    // `dataset.cssmvSafeStream = "1"` (set by compose-done after a
    // successful previous run, see line ~4741) AND it's actively
    // playing (not paused, not ended), we DON'T kill it. Otherwise
    // (no marker = unknown provenance, or already paused = nothing
    // to preserve) we run the legacy hard-kill.
    try {
      const SILENT_DATAURI = "data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=";
      const audioEl = document.getElementById("watch-audio-preview");
      const videoEl = document.getElementById("watch-video");
      const isSafeStream = (el) =>
        !!el &&
        el.dataset &&
        el.dataset.cssmvSafeStream === "1" &&
        !el.paused &&
        !el.ended &&
        Number(el.currentTime || 0) > 0;
      const audioSafe = isSafeStream(audioEl);
      const videoSafe = isSafeStream(videoEl);
      if (audioEl && !audioSafe) {
        try { audioEl.pause(); } catch (_e) {}
        try { audioEl.muted = true; } catch (_e) {}
        try { audioEl.volume = 0; } catch (_e) {}
        try { audioEl.srcObject = null; } catch (_e) {}
        try { audioEl.src = SILENT_DATAURI; audioEl.load && audioEl.load(); } catch (_e) {}
        try { audioEl.removeAttribute("src"); audioEl.load && audioEl.load(); } catch (_e) {}
        try { audioEl.volume = 1; } catch (_e) {}
      }
      if (videoEl && !videoSafe) {
        try { videoEl.pause(); } catch (_e) {}
        try { videoEl.muted = true; } catch (_e) {}
        try { videoEl.srcObject = null; } catch (_e) {}
        try { videoEl.src = SILENT_DATAURI; videoEl.load && videoEl.load(); } catch (_e) {}
        try { videoEl.removeAttribute("src"); videoEl.load && videoEl.load(); } catch (_e) {}
        try { videoEl.loop = false; videoEl.removeAttribute("loop"); } catch (_e) {}
      }
      // Other rogue <audio>: still safe to neutralise (none of them
      // should be a "safe stream" — the watch panel owns playback).
      document.querySelectorAll("audio").forEach((el) => {
        if (el.id === "watch-audio-preview") return;
        if (el.id === "mic-capture-audio") return;
        try { el.pause(); } catch (_e) {}
        try { el.muted = true; } catch (_e) {}
      });
      // Reset MediaSession only when we actually killed our own stream;
      // if we preserved playback the metadata should stay too.
      if (!audioSafe && !videoSafe) {
        try {
          if (navigator.mediaSession) {
            navigator.mediaSession.playbackState = "none";
            navigator.mediaSession.metadata = null;
          }
        } catch (_msErr) { /* non-fatal */ }
      }
      console.info(
        "%c[mv-pipeline][kill-stale-hard] audioSafe=%s videoSafe=%s — %s",
        "color:#a40;font-weight:bold",
        audioSafe, videoSafe,
        (audioSafe || videoSafe) ? "PRESERVED current playback (will hot-swap on compose-done)" : "killed all"
      );
    } catch (_killErr) { /* non-fatal */ }
    // CSSOS_PHASE2_AUDIO_CONTEXT_PRIME 20260428 #168.2 — Jing
    // "真零点击 unmuted autoplay — 当前 silent dataURI prime 不可靠，
    //  改 AudioContext.resume()，当前必须点击等再一次操作才播放有声音
    //  的媒体，必须改进，点击-直达MV自动播放。"
    //
    // The silent-mp3-dataURI prime worked on Chrome but Safari requires
    // a real AudioContext.resume() inside the user-gesture stack. Once
    // any AudioContext is resumed under user activation, ALL subsequent
    // `<video>.play()` and `<audio>.play()` calls in this tab session
    // are granted unmuted autoplay — no second click needed.
    try {
      if (!globalThis.__cssmvAudioCtx) {
        const Ctx = window.AudioContext || window.webkitAudioContext;
        if (Ctx) {
          globalThis.__cssmvAudioCtx = new Ctx();
        }
      }
      const ctx = globalThis.__cssmvAudioCtx;
      if (ctx && ctx.state === "suspended" && typeof ctx.resume === "function") {
        ctx.resume()
          .then(() => {
            console.info(
              "%c[mv-pipeline][audio-ctx] AudioContext resumed under user gesture — unmuted autoplay enabled session-wide",
              "color:#0a8;font-weight:bold"
            );
          })
          .catch((err) => {
            console.warn("[mv-pipeline][audio-ctx] resume rejected:", err);
          });
      } else if (ctx && ctx.state === "running") {
        console.info("[mv-pipeline][audio-ctx] AudioContext already running");
      }
    } catch (_ctxErr) {
      console.warn("[mv-pipeline][audio-ctx] init failed:", _ctxErr);
    }
    // CSSOS_PHASE2_AUDIO_GESTURE_PRIME 20260427 #159b — Jing
    // "兄弟，我已经答应用户，只需点击，视频画面必须和真音乐同步，
    //  不能让用户再点击。" — TRUE zero-click: user's click on the universal
    // entry IS the gesture. Prime the <audio> element NOW (still inside
    // user gesture stack) so when compose-done sets src + .play() later,
    // the browser still grants UNMUTED autoplay. Without this prime,
    // browsers require a fresh user gesture for any unmuted .play()
    // on a media element that hasn't yet played in this user-activation.
    try {
      const audioPrime = document.getElementById("watch-audio-preview");
      if (audioPrime) {
        // Set a 1-frame silent data URL — short, valid, doesn't 404.
        // 1KB silent mp3 base64 (44.1kHz mono, 0.04s).
        const silentMp3DataUri =
          "data:audio/mpeg;base64,SUQzBAAAAAABEVRYWFgAAAAtAAADY29tbWVudABCaWdT" +
          "b3VuZEJhbmsuY29tIC8gTGFTb25vdGhlcXVlLm9yZwBURU5DAAAAHQAAA1N3aXRjaCB" +
          "QbHVzIMKpIE5DSCBTb2Z0d2FyZQBUSVQyAAAABgAAAzIyMzUAVFNTRQAAAA8AAANMYXZmNTcuODMuMTAwAAAAAAAAAAAAAAD/+0DAAAAAAAAAAAAAAAAAAAAAAABJbmZvAAAADwAAAAEAAAEgAA";
        // .play() inside a click handler is allowed; the result resolves
        // and the element is "unlocked" for future muted/unmuted .play().
        audioPrime.muted = false;
        audioPrime.volume = 1;
        audioPrime.preload = "auto";
        audioPrime.src = silentMp3DataUri;
        const _gesturePromise = audioPrime.play();
        if (_gesturePromise && typeof _gesturePromise.then === "function") {
          _gesturePromise
            .then(function () {
              // Pause the silent priming, leave the element unlocked.
              try { audioPrime.pause(); } catch (_e) {}
              audioPrime.removeAttribute("src");
              audioPrime.load && audioPrime.load();
              console.info(
                "%c[mv-pipeline][audio-prime] <audio> unlocked under user gesture — unmuted autoplay enabled",
                "color:#0a8;font-weight:bold"
              );
            })
            .catch(function (err) {
              console.warn("[mv-pipeline][audio-prime] gesture prime rejected:", err);
            });
        }
        // Same trick on <video>.
        const videoPrime = document.getElementById("watch-video");
        if (videoPrime && typeof videoPrime.play === "function") {
          videoPrime.muted = true;
          const _vGesturePromise = videoPrime.play();
          if (_vGesturePromise && typeof _vGesturePromise.then === "function") {
            _vGesturePromise.catch(function () { /* expected if no src yet */ });
          }
        }
      }
    } catch (_e) { /* non-fatal */ }
    // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
    // "万能入口"统一到 MV Pipeline 流程. Any external caller of runAll()
    // (logo long-press, mic, play, right-click 一键MV, Apply Render, etc.)
    // can land here once they're rewired to call
    // `globalThis.cssmvMvPipelineRunAll(opts)`.
    void options; // explicit no-op so the linter doesn't strip the comment
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
    // CSSOS_PHASE2_HARVEST_USER_LYRICS 20260429 #168.7c — Jing
    // "我手动输入的歌词 ... 怪不得字幕只显示一个'{' ... 谁吃掉了我的歌词？"
    //
    // User typed lyrics into Advanced Settings (#custom-lyrics), NOT the
    // MV Pipeline's own textarea. runAll then saw empty #mvp-lyrics → ran
    // lyrics LLM → got English junk → broadcaster overwrote user's
    // Chinese in #custom-lyrics with English. NEVER again. Read from
    // every known lyric source first; whoever has the longest non-empty
    // body wins (that's the user's intentional input).
    if (!state.lyrics) {
      const candidates = [
        document.getElementById("custom-lyrics"),
        document.getElementById("creation-lyrics-input"),
        document.getElementById("watch-lyrics-editor"),
        document.getElementById("song-seed-lyrics"),
        document.querySelector("textarea[data-creation-field='lyrics']"),
      ];
      let longest = "";
      candidates.forEach((el) => {
        if (!(el instanceof HTMLTextAreaElement)) return;
        const v = String(el.value || "").trim();
        if (v.length > longest.length) longest = v;
      });
      // Also check creationState as a final fallback.
      const csLyrics = String(globalThis.creationState?.lyrics || "").trim();
      if (csLyrics.length > longest.length) longest = csLyrics;
      if (longest) {
        state.lyrics = longest;
        // Mirror back into the MV Pipeline textarea so the UI reflects what
        // we'll actually use.
        const mvpTa = panel.querySelector("#mvp-lyrics");
        if (mvpTa) mvpTa.value = longest;
        console.info(
          "%c[mv-pipeline][harvest-lyrics] adopted %d chars of user-typed lyrics from external textareas",
          "color:#0a8;font-weight:bold", longest.length
        );
      }
    }
    // Seed from caller (universal entry) has priority over empty inputs.
    if (seed) {
      if (!state.prompt && seed.prompt) state.prompt = String(seed.prompt).trim();
      if (!state.style && seed.style) state.style = String(seed.style).trim();
      if (!state.lyrics && seed.lyrics) state.lyrics = String(seed.lyrics).trim();
    }
    // CSSOS_PHASE2_LYRICS_BROADCAST_MANUAL 20260429 #168.7 — Jing
    // "我手动输入的是完整的歌词，可是MY pipeline面板回灌（广播）给别的
    //  相关的面板的歌词却是不完整的，有的面板甚至没有通知到，如高级
    //  设置面板，歌词为空."
    //
    // The lyrics-stage broadcaster (#167) only fires AFTER the lyrics
    // engine returns. Manual lyrics typed into MV Pipeline never reach
    // Advanced Settings textarea. Broadcast NOW so all surfaces see the
    // user's full body before any engine runs. Use a stronger overwrite
    // policy for this path: ALWAYS write into empty fields; for non-empty
    // fields write only when the new content is at least as long as
    // what's there (don't truncate user-typed Advanced text).
    if (state.lyrics) {
      try {
        const fullLyrics = state.lyrics;
        const targets = [
          document.getElementById("custom-lyrics"),
          document.getElementById("creation-lyrics-input"),
          document.getElementById("watch-lyrics-editor"),
          document.getElementById("song-seed-lyrics"),
          document.querySelector("textarea[data-creation-field='lyrics']"),
        ];
        let touched = 0;
        targets.forEach((el) => {
          if (!(el instanceof HTMLTextAreaElement)) return;
          // CSSOS_PHASE2_MANUAL_NEVER_CLOBBER 20260429 #168.7c — Jing
          // The manual-path broadcaster mirrors the user's MV Pipeline
          // textarea into other surfaces. Only fill empty fields —
          // never overwrite user-typed content elsewhere.
          if (!String(el.value || "").trim()) {
            el.value = fullLyrics;
            el.dispatchEvent(new Event("input", { bubbles: true }));
            el.dispatchEvent(new Event("change", { bubbles: true }));
            touched += 1;
          }
        });
        if (globalThis.creationState) {
          globalThis.creationState.lyrics = fullLyrics;
        }
        document.dispatchEvent(new CustomEvent("cssmv:lyrics-updated", {
          detail: { lyrics: fullLyrics, source: "mv-pipeline-runAll-manual" }
        }));
        console.info(
          "%c[mv-pipeline][lyrics-broadcast-manual] echoed %d chars to %d targets at runAll start",
          "color:#0a8;font-weight:bold", fullLyrics.length, touched
        );
      } catch (_e) { /* non-fatal */ }
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
    // CSSOS_MV_DAG_WAVE_2_7B 20260507 — show overall-progress block on the
    // ordinary MV PIPELINE panel for the duration of the run.
    try { showMvOverallProgress(true); } catch (_e) {}
    // CSSOS_PHASE2_PIN_RUN_ID 20260429 #170 — Jing
    // "我只点击一次，应该生成一首歌。可是通知面板...一下在出现48个作品"
    //
    // Root cause: every cssos:run_progress emit re-evaluated
    //   `state.runId || state.taskId || \`mv-${state.startedAt || Date.now()}\``
    // and since none of those were ever initialized, Date.now() produced a
    // FRESH runId per tick. Notifications panel keyed by runId → 1 ms tick =
    // 1 new card. Throttled at 800 ms ticks ≈ 48 cards over a typical run.
    //
    // Pin a single runId + startedAt for the whole run, so every emitter
    // (run_progress, run_created, kara_ready, autosave) reuses the same key
    // and the notification card stays as ONE card per run.
    if (!isResume || !state.runId) {
      state.startedAt = Date.now();
      state.runId = `mv-${state.startedAt}`;
    }
    // Announce the run so the notifications panel can create the canonical
    // card RIGHT NOW (before the 800ms-throttled progress ticks even fire).
    try {
      window.dispatchEvent(new CustomEvent("cssos:run_created", {
        detail: {
          run_id: state.runId,
          title: String(state.title || state.prompt || "").trim(),
          source: "mv-pipeline-panel-runAll"
        }
      }));
    } catch (_e) { /* non-fatal */ }
    if (!isResume) {
      state.costs = {};
      state.engines = {};
      state.coverUrl = null;
      state.audioUrl = null;
      state.audioUrlBackendOnly = null;
      state.videoUrl = null;
      state.subtitlesSrt = null;
      state.alignedLyrics = null; // #148-D — cleared per fresh run
      state.lyricSections = null; // #148-A2 — cleared per fresh run
      state.shotScripts = null;   // #148-B  — cleared per fresh run
      state.videoSegments = null; // #148-E  — cleared per fresh run
      state.mvUrl = null;
      // #147 — fresh pipeline run starts with a clean autosave guard so the
      // new mv_id (different from any prior run) is allowed to commit.
      state.committedMvId = "";
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
      // PARALLEL PIPELINE — Jing 2026-05-07
      // "6个可以同时呀，只要拿到了自己需要的东西，就走呀，别一个等一个."
      // Cover and lyrics have no inter-dependency (lyrics never reads
      // state.coverUrl; cover never reads state.lyrics). Music DOES depend on
      // state.lyrics (lyric-line counter drives target duration), so it stays
      // serial after lyrics. Video depends on cover.image_url + state.shotScripts
      // (set inside lyrics) — also stays serial. By kicking cover + lyrics off
      // concurrently we eliminate the cover-finishes-before-lyrics-starts wait,
      // which is the dominant T0 overlap available in this pipeline.
      //
      // Each stage block is wrapped in an async IIFE that throws on internal
      // stage failure, exactly like the original `await` chain did. We join
      // with Promise.allSettled then rethrow the first rejection so the outer
      // catch still resolves `failingStage` via findRunningStage().
      // CSSOS_MV_DAG_WAVE_7A 20260508 — Jing
      // Pure-function refactor skeleton. Stage helpers return plain output
      // objects; state mutations and fire-and-forget UX dispatches are
      // hoisted into applyStageOutput() / dispatchStageEvents() so the DAG
      // closure sequences them deterministically. 7a wires up the cover
      // branch only — lyrics/music/video/subs/compose still mutate inline
      // and will be lifted in 7b–7f.
      function applyStageOutput(state, stageId, output) {
        if (!output) return;
        if (stageId === "cover") {
          if (output.image_url) state.coverUrl = output.image_url;
        }
        // CSSOS_MV_DAG_WAVE_7B 20260508 — lyrics state mutations lifted out
        // of runLyricsStage. Output contract:
        //   { lyrics, sections?, shotScripts?, title?, engineRecord, userProvided }
        if (stageId === "lyrics") {
          if (typeof output.lyrics === "string") state.lyrics = output.lyrics;
          if (Object.prototype.hasOwnProperty.call(output, "sections")) {
            state.lyricSections = output.sections;
          }
          if (Object.prototype.hasOwnProperty.call(output, "shotScripts")) {
            state.shotScripts = output.shotScripts;
          }
          if (output.title && !String(state.title || "").trim()) {
            state.title = output.title;
          }
          if (output.userProvided && output.engineRecord) {
            state.engines = state.engines || {};
            state.engines["lyrics"] = output.engineRecord;
          }
        }
        // CSSOS_MV_DAG_WAVE_7C 20260508 — music state mutations lifted out
        // of runMusicStage. Output contract:
        //   { audioUrl, audioUrlBackendOnly?, duration, alignedLyrics?,
        //     karaJson?, title?, _resp, cost_cents }
        // Closure-bound DOM/dual-track state (altAudioUrl, tierCapSecs,
        // _switchToTake, etc.) stays inside the helper because those
        // mutations are produced by DOM closures we can't externalize
        // cleanly without churn — they're idempotent UX state, not
        // pipeline-correctness state.
        if (stageId === "music") {
          if (typeof output.audioUrl === "string") state.audioUrl = output.audioUrl;
          if (Object.prototype.hasOwnProperty.call(output, "audioUrlBackendOnly")) {
            state.audioUrlBackendOnly = output.audioUrlBackendOnly;
          }
          if (typeof output.duration === "number") state.duration = output.duration;
          if (Object.prototype.hasOwnProperty.call(output, "alignedLyrics")) {
            state.alignedLyrics = output.alignedLyrics;
          }
          if (Object.prototype.hasOwnProperty.call(output, "karaJson") && output.karaJson) {
            state.karaJson = output.karaJson;
          }
          if (output.title && !String(state.title || "").trim()) {
            state.title = output.title;
          }
        }
        // CSSOS_MV_DAG_WAVE_7D 20260508 — video state mutations lifted out
        // of runVideoStage. Output contract:
        //   { video_skipped?:bool, skipReason?:string, video_url?, segments?,
        //     videoDurSecs?, _resp?, cost_cents }
        if (stageId === "video") {
          if (output.video_skipped) {
            state.engines = state.engines || {};
            state.engines["video"] = {
              engine: "skipped",
              version: output.skipReason || "skipped",
              provider_model: null,
              cost_cents: 0,
              input_tokens: null,
              output_tokens: null
            };
            state.videoUrl = null;
          } else {
            if (typeof output.video_url === "string") state.videoUrl = output.video_url;
            if (Object.prototype.hasOwnProperty.call(output, "segments")) {
              state.videoSegments = output.segments;
            }
            if (typeof output.videoDurSecs === "number") {
              state.videoDurSecs = output.videoDurSecs;
            }
          }
        }
        // CSSOS_MV_DAG_WAVE_7E 20260508 — subs state mutations lifted out
        // of runSubsStage. Output contract:
        //   { subtitlesSrt?, subtitlesAss?, skipped?:bool, _resp?, cost_cents,
        //     lineCount? }
        if (stageId === "subs") {
          if (output.skipped) {
            state.subtitlesSrt = null;
            state.engines = state.engines || {};
            state.engines["subtitles"] = {
              engine: "skipped",
              version: "none",
              provider_model: null,
              cost_cents: 0,
              input_tokens: null,
              output_tokens: null
            };
          } else {
            state.subtitlesSrt = output.subtitlesSrt || null;
            state.subtitlesAss = output.subtitlesAss || null;
          }
        }
        // CSSOS_MV_DAG_WAVE_7F 20260508 — compose state mutations lifted out
        // of runComposeStage. Output contract:
        //   { composed?, public_url?, mv_id?, cost_cents }
        // Note: state.duration backfill from <audio> loadedmetadata stays
        // inside the helper because it's an async DOM-driven correction
        // (not part of the pipeline-correctness contract).
        if (stageId === "compose") {
          if (output.public_url) state.mvUrl = output.public_url;
        }
      }
      function dispatchStageEvents(state, stageId, output, meta) {
        if (meta && meta.cached) return;
        if (!output) return;
        if (stageId === "cover" && output.image_url) {
          // Face detect — fire-and-forget, non-blocking.
          void detectCoverFaceFocusOnce(output.image_url).catch(() => {});
          // Slideshow start — fire-and-forget UX enhancement.
          try {
            if (typeof globalThis.cssmvSetCoverSlides === "function") {
              globalThis.cssmvSetCoverSlides([output.image_url]);
            }
            if (typeof globalThis.cssmvStartCoverSlideshow === "function") {
              globalThis.cssmvStartCoverSlideshow({ mv: true, music: true });
            }
          } catch (_slideshowErr) { /* non-blocking UX; swallow */ }
        }
        // CSSOS_MV_DAG_WAVE_7B 20260508 — lyrics broadcast lifted out of
        // runLyricsStage. Mirrors the original P2-LYRICS_BROADCAST flow:
        // fill empty target textareas + creationState + custom event +
        // syncWatchOutputs. All idempotent (only writes empty fields).
        if (stageId === "lyrics" && typeof output.lyrics === "string") {
          try {
            const fullLyrics = output.lyrics;
            const targets = [
              document.getElementById("custom-lyrics"),
              document.getElementById("creation-lyrics-input"),
              document.getElementById("watch-lyrics-editor"),
              document.getElementById("song-seed-lyrics"),
              document.getElementById("mvp-lyrics"),
              document.querySelector("textarea[data-creation-field='lyrics']"),
            ];
            targets.forEach((el) => {
              if (!(el instanceof HTMLTextAreaElement)) return;
              if (!el.value.trim()) {
                el.value = fullLyrics;
                el.dispatchEvent(new Event("input", { bubbles: true }));
                el.dispatchEvent(new Event("change", { bubbles: true }));
              }
            });
            if (globalThis.creationState) {
              globalThis.creationState.lyrics = fullLyrics;
            }
            document.dispatchEvent(new CustomEvent("cssmv:lyrics-updated", {
              detail: { lyrics: fullLyrics, source: "mv-pipeline-panel" }
            }));
          } catch (_broadcastErr) {
            console.warn("[mv-pipeline][lyrics-broadcast] failed:", _broadcastErr);
          }
          try { syncWatchOutputs(); } catch (_e) { /* non-fatal */ }
        }
        // CSSOS_MV_DAG_WAVE_7C 20260508 — music broadcast lifted out of
        // runMusicStage. The kara_ready dispatch fires from compose (not
        // music), so it isn't lifted here — the only music-stage broadcast
        // is syncWatchOutputs(), which re-syncs Watch editors with the new
        // title + duration. cssos:title_resolved stays inline because it's
        // tightly coupled to runId resolution that lives inside the helper.
        if (stageId === "music") {
          try { syncWatchOutputs(); } catch (_e) { /* non-fatal */ }
        }
        // CSSOS_MV_DAG_WAVE_7D 20260508 — video broadcast lifted out of
        // runVideoStage. Only re-syncs Watch editors after a successful
        // video stage so the storyboard line picks up state.videoUrl.
        if (stageId === "video" && !output.video_skipped && output.video_url) {
          try { syncWatchOutputs(); } catch (_e) { /* non-fatal */ }
        }
        // CSSOS_MV_DAG_WAVE_7F 20260508 — compose broadcast lifted out of
        // runComposeStage. Two events:
        //   1) cssos:kara_ready — notification panel hydration payload.
        //   2) cssmv:run-finish — fired AFTER saveAsWork resolves so
        //      cinema-mode storm + auto-cinema can react. The autosave
        //      itself stays inside the helper (it's a fire-and-forget
        //      side-effect tightly coupled to autoplay/hot-swap UX);
        //      we intercept its callback here only to re-fire run-finish.
        // The autoplay / fullscreen / <video>+<audio> hot-swap stays in
        // the helper because it's all DOM manipulation (no state.* writes)
        // and lifting would balloon dispatchStageEvents.
        if (stageId === "compose" && output && output.composed) {
          const composed = output.composed;
          try {
            window.dispatchEvent(new CustomEvent("cssos:kara_ready", {
              detail: {
                run_id: state.runId || composed.mv_id || "",
                stage: "ready",
                title: state.title || "",
                workTitle: state.title || "",
                mvUrl: state.mvUrl || "",
                audioUrl: state.audioUrl || "",
                coverUrl: state.coverUrl || "",
                subtitlesSrt: state.subtitlesSrt || "",
                workId: composed.mv_id || "",
                duration: state.duration || 0
              }
            }));
          } catch (_dispatchErr) { /* non-fatal */ }
        }
      }

      // Stage 1 — cover (+ 4 parallel variations for 5-image slideshow)
      // CSSOS_MV_DAG_WAVE_7A 20260508 — Jing
      // Pure helper: returns the cover output. No state mutation, no
      // setStage, no recordEngine, no slideshow dispatch, no face-detect.
      // Variations remain here as a TODO for wave 7b — they're already
      // fire-and-forget so they don't taint the return contract, but they
      // belong in dispatchStageEvents alongside the slideshow trigger.
      async function runCoverStage(state, _opts) {
        const coverSuffix = (globalThis.currentLocale === "zh")
          ? COVER_PROMPT_SUFFIX_ZH
          : COVER_PROMPT_SUFFIX_EN;
        const cover = await postJson(
          "/api/mv/cover",
          withEngine("cover", {
            prompt: state.prompt + coverSuffix,
            ratio: state.outputSpec && state.outputSpec.runwayImageRatio
              ? state.outputSpec.runwayImageRatio
              : null
          })
        );
        // TODO(wave 7b): lift variations into dispatchStageEvents("cover").
        // CSSOS_MV_DAG_WAVE_2_7C_LITE_SKIP 20260507 — Jing
        // Lite tier is image-only ken-burns over the primary cover; the 4
        // variation calls feed the 5-image slideshow used by Hybrid +
        // Cinematic. For Lite they're pure waste — skip them.
        try {
          let _coverTierId = "";
          try {
            if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.currentTierId === "function") {
              _coverTierId = String(globalThis.cssmvTiers.currentTierId() || "").toLowerCase();
            }
          } catch (_e) { /* ignore */ }
          if (_coverTierId !== "lite") {
            const variationSuffixesZh = ["，特写", "，广角", "，侧光", "，柔雾"];
            const variationSuffixesEn = [", close-up framing", ", wide-angle composition", ", rim light", ", soft haze"];
            const variationSuffixes = (globalThis.currentLocale === "zh")
              ? variationSuffixesZh
              : variationSuffixesEn;
            variationSuffixes.forEach(function (suffix) {
              postJson(
                "/api/mv/cover",
                withEngine("cover", {
                  prompt: state.prompt + coverSuffix + suffix,
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
          } else {
            console.info("[mv-pipeline][cover] Lite tier — skipping 4 variation calls");
          }
        } catch (_variationsErr) { /* non-blocking UX; swallow */ }
        return cover;
      }

      // CSSOS_MV_DAG_WAVE_2_7C 20260507 — Jing
      // Cover/lyrics/music/video/subs/compose all run via the DAG executor
      // below (after every stage helper is declared). Cover task wraps
      // runCoverStage with the same setStage/recordEngine semantics the
      // legacy IIFE used so behavior is byte-identical.

      // Stage 2 — lyrics (real LLM call when user provided no lyrics)
      // CSSOS_MV_DAG_WAVE_2_7B 20260507 — body lifted into runLyricsStage()
      // so both legacy IIFE path and DAG executor path can call it.
      // CSSOS_MV_DAG_WAVE_7B 20260508 — pure-helper refactor:
      //   • returns { lyrics, sections, shotScripts, title, engineRecord,
      //     userProvided, _resp } so caller can sequence applyStageOutput +
      //     recordEngine + dispatchStageEvents deterministically.
      //   • setStage / recordEngine / state mutations / lyrics-updated event
      //     and syncWatchOutputs are owned by the DAG callback.
      //   • Advanced-Settings writeDom block remains inline as a
      //     fire-and-forget UX echo (idempotent fill-empty, not part of the
      //     pipeline correctness contract). deriveSettingsForUserLyrics IIFE
      //     also stays inline (already async/non-deterministic).
      async function runLyricsStage(state, _opts) {
      if (!(STAGE_ORDER.indexOf("lyrics") >= resumeStartIdx)) return null;
      const _userProvidedLyrics = !!state.lyrics;
      if (!_userProvidedLyrics) {
        // P2-41 Jing 2026-04-18: pass language + civilization to LLM so the
        // lyrics come back in the intended locale and cultural frame. Without
        // this, the backend default prompt always produces EN/ZH lyrics.
        //
        // CSSOS_PHASE2_CIVILIZATION_LYRICS_V2 20260430 #219b — Jing
        // "lang=en civ=(none) frame=(none) ... 输出英文歌词，请再继续修复，
        //  让文明真正智能联动."
        //
        // Root cause of the previous miss: `resolveUiPrimaryLanguageModule`
        // defaults to "en" when nothing's been set explicitly, so it ALWAYS
        // returned a value — and the title-script inference branch (which
        // would have caught `妲己` as zh) never ran because it was last in
        // the chain.
        //
        // New priority (highest → lowest), with title-script jumping ahead
        // of the UI default because the user's TYPED CONTENT is a stronger
        // signal than a sticky UI flag:
        //   1. Explicit per-run state.language (if MV PIPELINE has its own)
        //   2. Per-run creationState.language explicitly chosen
        //   3. **Title-script inference** (`妲己` Han → zh, kana → ja,
        //      Latin-only → en) — the user's actual content wins over UI
        //      defaults so a Chinese title generates Chinese lyrics even
        //      when the UI was last set to English
        //   4. document.documentElement.lang (current i18n locale)
        //   5. globalThis.resolveUiPrimaryLanguageModule() — UI fallback
        //      (this is the one that defaults to "en" — DEMOTED last)
        //   6. "en" hardcoded last resort
        //
        // Also logs each step so future regressions are traceable.
        // CSSOS_PHASE2_USER_TOUCHED_LANG 20260430 #219d — Jing
        // "state=en creation=en title-script=zh ... → resolved=en, 还是英文歌词"
        // Root cause: state.language and creationState.language come from
        // a sticky default "en" that gets persisted across sessions. The
        // user typed `妲己` (clearly Chinese content) but the default
        // shadowed the actual signal.
        //
        // Fix: only let state.language / creationState.language win if the
        // user EXPLICITLY chose a language via the picker (markCreationField-
        // Touched("language") was called). If they're just defaults, fall
        // through to title-script inference and let the content speak.
        const userTouchedLanguage = (function () {
          try {
            return typeof globalThis.hasCreationFieldTouchedModule === "function" &&
              !!globalThis.hasCreationFieldTouchedModule("language");
          } catch (_e) {
            return false;
          }
        })();
        const stateLangRaw = String(state.language || "").trim().toLowerCase();
        const creationLangRaw = String(
          state.creationLanguage || globalThis.creationState?.language || ""
        ).trim().toLowerCase();
        // Only honor explicit values when user explicitly touched the picker.
        const tryStateExplicit = userTouchedLanguage ? stateLangRaw : "";
        const tryCreationExplicit = userTouchedLanguage ? creationLangRaw : "";
        // Title-script inference. Pull from EVERY likely source (panel
        // input + state) so we don't miss when state.title hasn't synced.
        const titleSource = (function () {
          const panelTitleEl = document.getElementById("mvp-title");
          const panelPromptEl = document.getElementById("mvp-prompt");
          return [
            String(panelTitleEl?.value || "").trim(),
            String(panelPromptEl?.value || "").trim(),
            String(state.title || "").trim(),
            String(state.prompt || "").trim(),
          ].filter(Boolean).join(" ");
        })();
        const tryTitleScript = (function () {
          if (!titleSource) return "";
          // Hiragana/Katakana → ja first (Han is also valid in ja but
          // kana-presence is the strongest "this is Japanese" signal).
          if (/[぀-ゟ゠-ヿ]/.test(titleSource)) return "ja";
          if (/[一-鿿]/.test(titleSource)) return "zh";
          if (/[가-힯]/.test(titleSource)) return "ko";
          if (/[А-я]/.test(titleSource)) return "ru";
          if (/[A-Za-z]/.test(titleSource)) return "en";
          return "";
        })();
        const tryHtmlLang = String(document.documentElement.lang || "").split(/[-_]/)[0].toLowerCase();
        let tryUiModule = "";
        try {
          if (typeof globalThis.resolveUiPrimaryLanguageModule === "function") {
            tryUiModule = String(globalThis.resolveUiPrimaryLanguageModule() || "").trim().toLowerCase();
          }
        } catch (_e) {}
        // CSSOS_PHASE2_NON_LATIN_WINS 20260430 #219e — Jing
        // "user-touched-lang=yes ... title-script=zh ... → resolved=en, 还是英文歌词."
        // The touched-lang flag fires from too many code paths (apply-
        // derive, civilization defaults, etc.) so it can't be trusted as
        // "user explicitly chose this language". A deterministic, user-
        // intent-respecting rule that beats every flag-races: NON-LATIN
        // SCRIPT IN THE TITLE ALWAYS WINS. If the user types `妲己`
        // (Han chars) the lyrics MUST be Chinese. If the title contains
        // hiragana/kana → Japanese. Hangul → Korean. Cyrillic → Russian.
        // Latin-only is ambiguous (en/es/fr/de all share the alphabet)
        // so we fall through to state.language → UI module → "en".
        //
        // This is the stop-asking-questions rule that gets the user
        // what they meant 99% of the time. They can still override by
        // explicitly writing English lyrics into the lyrics box for the
        // run; the user-typed lyrics path bypasses this LLM call entirely.
        const nonLatinScripts = new Set(["zh", "ja", "ko", "ru"]);
        let resolvedLang;
        if (tryTitleScript && nonLatinScripts.has(tryTitleScript)) {
          // Hard override — user typed non-Latin content, lyrics MUST match.
          resolvedLang = tryTitleScript;
        } else {
          resolvedLang =
            tryStateExplicit ||
            tryCreationExplicit ||
            tryTitleScript ||
            tryHtmlLang ||
            tryUiModule ||
            "en";
        }
        const resolvedCiv = String(
          state.civilization ||
          globalThis.creationState?.civilization ||
          ""
        ).trim() || null;
        const resolvedFrame = String(
          state.culturalFrame ||
          globalThis.creationState?.culturalFrame ||
          ""
        ).trim() || null;
        // CSSOS_PHASE2_TRACE_VISIBLE 20260430 #219c — Jing
        // "civilization-cascade v2 都没有出现" — the previous trace used
        // console.info which Safari's "240 messages filtered" hides by
        // default. Promote to console.warn so it survives the default
        // info filter; tag with [VISIBLE] prefix for fast grepping.
        const nonLatinOverride =
          tryTitleScript && nonLatinScripts.has(tryTitleScript);
        console.warn(
          "[VISIBLE][mv-pipeline][lyrics] civilization-cascade v2: " +
          "title-script=" + (tryTitleScript || "(none)") +
          (nonLatinOverride
            ? " [NON-LATIN OVERRIDE — title beats every other signal]"
            : " (latin-only, falling through to state/ui)") +
          " state=" + (tryStateExplicit || "(none)") +
          " creation=" + (tryCreationExplicit || "(none)") +
          " html-lang=" + (tryHtmlLang || "(none)") +
          " ui-module=" + (tryUiModule || "(none)") +
          " user-touched-lang=" + (userTouchedLanguage ? "yes" : "no") +
          " → resolved=" + resolvedLang
        );
        console.warn(
          "[VISIBLE][mv-pipeline][lyrics] " +
          "civ=" + (resolvedCiv || "(none)") +
          " frame=" + (resolvedFrame || "(none)") +
          " title-source=" + (titleSource || "(empty)").slice(0, 60)
        );
        const lyricsResp = await postJson(
          "/api/mv/lyrics",
          withEngine("lyrics", {
            prompt: state.prompt,
            style: state.style || null,
            language: resolvedLang || null,
            civilization: resolvedCiv,
            cultural_frame: resolvedFrame,
            // CSSOS_PHASE2_JINGDIAN_TEMPLATE 20260501 #261 — Jing
            // "歌词引擎没有使用京典模版，而是随机输出歌词结构。请优先
            //  使用京典模版10节歌词结构."
            // Default to the 10-section 京典 template unless a caller
            // explicitly overrides via state.sectionForm.
            section_form: Array.isArray(state.sectionForm) && state.sectionForm.length
              ? state.sectionForm
              : (globalThis.CSSOS_JINGDIAN_SECTIONS
                  ? Array.from(globalThis.CSSOS_JINGDIAN_SECTIONS)
                  : ["Verse 1","Verse 2","Chorus 1","Verse 3","Verse 4",
                     "Chorus 2","Bridge","Chorus 3","Chorus 4","Outro"]),
            template: "jingdian_10",
          })
        );
        // Normalize whatever shape comes back into clean section-divided
        // text BEFORE storing it on state.lyrics — downstream broadcast
        // hands the textarea exactly what the user wants to read.
        const _normLyrics = (typeof globalThis.cssosNormalizeLyricsText === "function")
          ? globalThis.cssosNormalizeLyricsText
          : (s) => String(s || "").trim();
        const _outLyrics = _normLyrics(lyricsResp.lyrics || "");
        // CSSOS_PHASE2_LYRICS_TITLE_BACKFILL 20260505 — title only adopted
        // by applyStageOutput when state.title is still empty.
        const _outTitle = String(lyricsResp.title || "").trim() || null;
        // CSSOS_PHASE2_LYRIC_SECTIONS 20260426 #148-A2 + #148-B — Jing
        // Capture structured sections + shot scripts when LLM emitted them.
        // Both fields are optional in the response — when absent (older
        // models, transient runs) the pipeline falls back to single-clip
        // video and even-divide subtitles, preserving prior behavior.
        const _outSections = Array.isArray(lyricsResp.sections) && lyricsResp.sections.length > 0
          ? lyricsResp.sections
          : null;
        const _outShotScripts = Array.isArray(lyricsResp.shot_scripts) && lyricsResp.shot_scripts.length > 0
          ? lyricsResp.shot_scripts
          : null;
        console.info(
          "%c[mv-pipeline][lyrics] sections=%s shot_scripts=%s",
          "color:#0c0;font-weight:bold",
          _outSections ? _outSections.length : "none",
          _outShotScripts ? _outShotScripts.length : "none"
        );
        // CSSOS_PHASE2_CIV_DERIVED_SETTINGS 20260427 #160 — Jing
        // "所有 Advanced Settings 字段都由 lyrics 引擎根据 UI 主语言文明
        //  联动派生" — apply lyrics-engine-derived settings into the
        // creationState UI so VOICE GENDER, WORK TYPE, DURATION,
        // MUSIC STYLE, TEMPO, KEY, VOCAL STYLE, ENSEMBLE, INSTRUMENTATION,
        // SECTION FORM, REFERENCE ARTISTS all reflect the civilization
        // the lyrics belong to. Only fills empty fields — never overrides
        // a value the user explicitly set.
        try {
          const derived = lyricsResp.derived_settings || lyricsResp.suggested || {};
          const cs = globalThis.creationState;
          const sels = (cs && cs.selections) || {};
          const fillIfEmpty = function (key, value) {
            if (value == null || value === "") return;
            if (cs[key] == null || cs[key] === "" || (typeof cs[key] === "number" && !cs[key])) {
              cs[key] = value;
            }
          };
          if (cs) {
            fillIfEmpty("workType", String(derived.work_type || "").trim());
            fillIfEmpty("duration", Number(derived.duration_secs || 0) || null);
            fillIfEmpty("tempo", Number(derived.tempo_bpm || 0) || null);
            fillIfEmpty("key", String(derived.key || "").trim());
            fillIfEmpty("vocalStyle", String(derived.vocal_style || "").trim());
            fillIfEmpty("ensembleStyle", String(derived.ensemble_style || "").trim());
            fillIfEmpty("instrumentation", String(derived.instrumentation || "").trim());
            fillIfEmpty("sectionForm", String(derived.section_form || "").trim());
            fillIfEmpty("articulationBias", String(derived.articulation_bias || "").trim());
            fillIfEmpty("voicingRegister", String(derived.voicing_register || "").trim());
            fillIfEmpty("expressionCcBias", String(derived.expression_cc_bias || "").trim());
            fillIfEmpty("inspirationNotes", String(derived.inspiration_notes || "").trim());
            fillIfEmpty("referenceArtists", String(derived.reference_artists || "").trim());
            fillIfEmpty("language", String(derived.language || "").trim());
            // VocalGender lives in selections.
            if (derived.voice_gender && (!sels.vocalGender || sels.vocalGender === "")) {
              sels.vocalGender = String(derived.voice_gender).trim();
            }
            // Genre/mood/instrument/ambience also flow through selections.
            if (derived.genre && (!sels.genre || sels.genre === "")) {
              sels.genre = String(derived.genre).trim();
            }
            if (derived.mood && (!sels.mood || sels.mood === "")) {
              sels.mood = String(derived.mood).trim();
            }
            if (derived.instrument && (!sels.instrument || sels.instrument === "")) {
              sels.instrument = String(derived.instrument).trim();
            }
            if (derived.ambience && (!sels.ambience || sels.ambience === "")) {
              sels.ambience = String(derived.ambience).trim();
            }
            console.info(
              "%c[mv-pipeline][derived-settings] applied to creationState: %o",
              "color:#0c0;font-weight:bold", derived
            );
            // CSSOS_PHASE2_DERIVED_TO_DOM 20260429 #168.7b — Jing
            // "其他选项都在静静等待着回灌呢. 比如：标题，声线性别，出处/
            //  故事链接，总视频提纲，音乐结构，分节视频脚本，音乐风格，
            //  速度（BPM），调式，时长（秒），语言，WORK TYPE，
            //  INSTRUMENTATION, 演唱风格, 编制风格, 授权风格包, 外部音频
            //  适配器, 编曲密度, 动态曲线, 段落结构, 奏法偏向, 声部音区,
            //  打击活跃度, EXPRESSION CC BIAS, HUMANIZATION, INSPIRATION
            //  NOTES, REFERENCE ATLAS, DEFAULT LISTEN PRICE, CURRENT
            //  UNIVERSE."
            //
            // CSSOS_PHASE2_EMPTY_DEFAULTS_v3 20260430 #181c — Jing
            // "高级设置面板仍然被自动塞了 15 项数据，应该有 25 项左右选项的
            //  数据吧？应该根据文明智能联动的原则由标题/歌词内容/音乐风格
            //  来影响这些选项的数据的随机输出，并由万能入口们回灌这些数据。"
            //
            // Reversal of #181b: re-enable auto-fill by DEFAULT, because
            // after #219e the cascade actually picks the right language
            // for the content (`妲己` → zh), so the LLM-derived values
            // are NOW civilization-aware (中国风/古风, mandopop, dizi,
            // pipa, etc.) — not the random English-default leak that
            // motivated #181b. The 25 Advanced Settings fields are part
            // of the "content-driven smart cascade" the user wants.
            //
            // Toggle is now OPT-OUT: default `true`. Set
            // `state.allowDerivedSettingsAutoFill = false` to suppress.
            // writeDom still respects user-typed values (won't override).
            const _autoFillAdvancedAllowed = state.allowDerivedSettingsAutoFill !== false;
            // Write derived_settings directly into the DOM input IDs.
            // Only fill empty inputs (don't override user-typed values).
            const writeDom = function (selector, value) {
              if (value == null || value === "") return;
              const el = document.querySelector(selector);
              if (!el) return;
              const cur = String(el.value || "").trim();
              if (cur) return; // don't override user
              el.value = String(value);
              el.dispatchEvent(new Event("input", { bubbles: true }));
              el.dispatchEvent(new Event("change", { bubbles: true }));
            };
            // Always-fill (these are essential for the pipeline + already
            // in the visible top-level form, not the dense Advanced panel):
            //   - title, voice gender, lyrics broadcast, music structure
            // Title — only set if user didn't type one. lyricsResp.title is
            // the engine's chosen title; fall back to lyrics first line.
            writeDom("#creation-title", lyricsResp.title || derived.title);
            writeDom("#mvp-title", lyricsResp.title || derived.title);
            if (!_autoFillAdvancedAllowed) {
              console.info(
                "%c[mv-pipeline][derived-settings] auto-fill OFF (default). " +
                "Advanced Settings inputs stay blank — click the magic wand " +
                "to fill from this run's derived_settings.",
                "color:#888"
              );
            } else {
            // Voice gender select.
            writeDom("#voice-input", derived.voice_gender);
            writeDom("#creation-voice-gender", derived.voice_gender);
            // Sources / story links.
            writeDom("#wiki-sources", derived.story_sources || derived.reference_atlas);
            writeDom("#creation-story-links", derived.story_sources || derived.reference_atlas);
            // Video outline / music structure / section scene prompts.
            writeDom("#video-outline-input", derived.video_outline);
            writeDom("#creation-video-outline", derived.video_outline);
            writeDom("#music-structure-input", derived.music_structure || derived.section_form);
            writeDom("#creation-music-structure", derived.music_structure || derived.section_form);
            writeDom("#section-scene-prompts", derived.section_scene_prompts);
            // Music style + tempo + key + duration + language.
            writeDom("#mvp-style", derived.genre || derived.music_style);
            writeDom("#creation-style", derived.genre || derived.music_style);
            writeDom("#creation-tempo", derived.tempo_bpm);
            writeDom("#creation-key", derived.key);
            writeDom("#creation-duration", derived.duration_secs);
            writeDom("#creation-language", derived.language);
            // Work type.
            writeDom("#creation-work-type", derived.work_type);
            // Instrumentation / vocal style / ensemble / license / adapter.
            writeDom("#creation-instrumentation", derived.instrumentation);
            writeDom("#creation-vocal-style", derived.vocal_style);
            writeDom("#creation-ensemble", derived.ensemble_style);
            writeDom("#creation-license", derived.licensed_style_pack);
            writeDom("#creation-adapter", derived.external_audio_adapter);
            // Arrangement density / dynamics curve / section form / articulation /
            // register / percussion / expression / humanization.
            writeDom("#creation-arrangement-density", derived.arrangement_density);
            writeDom("#creation-dynamics-curve", derived.dynamics_curve);
            writeDom("#creation-section-form", derived.section_form);
            writeDom("#creation-articulation", derived.articulation_bias);
            writeDom("#creation-register", derived.voicing_register);
            writeDom("#creation-percussion", derived.percussion_activity);
            writeDom("#creation-expression-cc", derived.expression_cc_bias);
            writeDom("#creation-humanization", derived.humanization);
            // Inspiration notes / reference atlas.
            writeDom("#creation-inspiration", derived.inspiration_notes);
            writeDom("#creation-reference-atlas", derived.reference_artists || derived.reference_atlas);
            // Default listen price (cents → $X.XX).
            if (derived.default_listen_price_cents != null) {
              const dollars = (Number(derived.default_listen_price_cents) / 100).toFixed(2);
              writeDom("#creation-default-listen", dollars);
            } else if (derived.default_listen_price_usd != null) {
              writeDom("#creation-default-listen", Number(derived.default_listen_price_usd).toFixed(2));
            }
            // Current Universe — civilization summary string.
            writeDom("#creation-current-universe", derived.current_universe || derived.civilization_summary);
            console.info(
              "%c[mv-pipeline][derived-to-dom] echoed derived_settings into Advanced Settings inputs",
              "color:#0c0;font-weight:bold"
            );
            // Re-render Advanced Settings UI so the user sees the filled values.
            try { globalThis.renderAdvancedSettingsModule?.(); } catch (_e) {}
            try { globalThis.syncCreationStateToLegacyInputs?.(); } catch (_e) {}
            } // end if (_autoFillAdvancedAllowed)
          }
        } catch (_derivedErr) {
          console.warn("[mv-pipeline][derived-settings] apply failed:", _derivedErr);
        }
        // P2-31: syncWatchOutputs lifted to dispatchStageEvents("lyrics").
        return {
          lyrics: _outLyrics,
          sections: _outSections,
          shotScripts: _outShotScripts,
          title: _outTitle,
          userProvided: false,
          _resp: lyricsResp,
          cost_cents: lyricsResp.cost_cents || 0,
        };
      } else {
        // User-provided lyrics don't incur LLM cost; still record the stage.
        // CSSOS_MV_DAG_WAVE_7B — engineRecord lifted into applyStageOutput.
        // CSSOS_PHASE2_DERIVE_FROM_USER_LYRICS 20260429 #178 — Jing
        // "标题没有回灌. 声线默认女声. 总视频提纲... 默认应该留空"
        // When user provides lyrics, we skip the lyrics LLM call entirely,
        // so derived_settings (title, voice gender, music style, BPM, key,
        // instrumentation, story sources, video outline, etc.) never get
        // populated. Fire a separate "derive-only" LLM call that takes
        // user lyrics as input and returns ONLY the derived_settings + a
        // good title + sections + shot_scripts. Same /api/mv/lyrics
        // endpoint but with the user's lyrics inlined into the prompt
        // and a system instruction telling the LLM to keep the lyrics
        // unchanged.
        (async function deriveSettingsForUserLyrics() {
          try {
            const deriveResp = await postJson(
              "/api/mv/lyrics",
              withEngine("lyrics", {
                prompt:
                  "Derive a title, video outline, music style, BPM, key, " +
                  "instrumentation, voice gender, vocal style, and full " +
                  "derived_settings envelope for the lyrics below. " +
                  "Do NOT rewrite the lyrics — return them unchanged in " +
                  "the lyrics field. Also produce shot_scripts (one " +
                  "visual scene description per section). Lyrics:\n\n" +
                  String(state.lyrics).slice(0, 4000),
                style: state.style || null,
                language: state.language || state.creationLanguage || null,
                civilization: state.civilization || null,
                cultural_frame: state.culturalFrame || null,
              })
            );
            // Don't overwrite the user's lyrics with whatever LLM returned —
            // user-provided lyrics are sacred. Only adopt sections/shot
            // scripts/derived_settings.
            state.lyricSections =
              Array.isArray(deriveResp.sections) && deriveResp.sections.length > 0
                ? deriveResp.sections
                : null;
            state.shotScripts =
              Array.isArray(deriveResp.shot_scripts) &&
              deriveResp.shot_scripts.length > 0
                ? deriveResp.shot_scripts
                : null;
            // Adopt title if user didn't have one yet.
            if (!state.title && deriveResp.title) {
              state.title = String(deriveResp.title).trim();
            }
            // Apply derived_settings — same logic as the regenerate path.
            const derived = deriveResp.derived_settings || {};
            try {
              const cs = globalThis.creationState;
              if (cs) {
                const fillIfEmpty = function (key, value) {
                  if (value == null || value === "") return;
                  if (
                    cs[key] == null ||
                    cs[key] === "" ||
                    (typeof cs[key] === "number" && !cs[key])
                  ) {
                    cs[key] = value;
                  }
                };
                fillIfEmpty("workType", String(derived.work_type || "").trim());
                fillIfEmpty("duration", Number(derived.duration_secs || 0) || null);
                fillIfEmpty("tempo", Number(derived.tempo_bpm || 0) || null);
                fillIfEmpty("key", String(derived.key || "").trim());
                fillIfEmpty("vocalStyle", String(derived.vocal_style || "").trim());
                fillIfEmpty("ensembleStyle", String(derived.ensemble_style || "").trim());
                fillIfEmpty("instrumentation", String(derived.instrumentation || "").trim());
                fillIfEmpty("sectionForm", String(derived.section_form || "").trim());
                fillIfEmpty("articulationBias", String(derived.articulation_bias || "").trim());
                fillIfEmpty("voicingRegister", String(derived.voicing_register || "").trim());
                fillIfEmpty("expressionCcBias", String(derived.expression_cc_bias || "").trim());
                fillIfEmpty("inspirationNotes", String(derived.inspiration_notes || "").trim());
                fillIfEmpty("referenceArtists", String(derived.reference_artists || "").trim());
                fillIfEmpty("language", String(derived.language || "").trim());
              }
              const writeDom = function (selector, value) {
                if (value == null || String(value).trim() === "") return;
                try {
                  const el = document.querySelector(selector);
                  if (!el) return;
                  if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
                    if (!el.value || !String(el.value).trim()) {
                      el.value = String(value);
                      el.dispatchEvent(new Event("input", { bubbles: true }));
                      el.dispatchEvent(new Event("change", { bubbles: true }));
                    }
                  }
                } catch (_e) { /* non-fatal */ }
              };
              writeDom("#creation-title", state.title || derived.title);
              writeDom("#mvp-title", state.title || derived.title);
              writeDom("#voice-input", derived.voice_gender);
              writeDom("#creation-voice-gender", derived.voice_gender);
              writeDom("#wiki-sources", derived.story_sources || derived.reference_atlas);
              writeDom("#creation-story-links", derived.story_sources || derived.reference_atlas);
              writeDom("#video-outline-input", derived.video_outline);
              writeDom("#creation-video-outline", derived.video_outline);
              writeDom("#music-structure-input", derived.music_structure || derived.section_form);
              writeDom("#creation-music-structure", derived.music_structure || derived.section_form);
              // Section scene prompts: VISUAL storyboard per section, NOT lyrics.
              writeDom("#section-scene-prompts", derived.section_scene_prompts);
              writeDom("#mvp-style", derived.genre || derived.music_style);
              writeDom("#creation-style", derived.genre || derived.music_style);
              writeDom("#creation-tempo", derived.tempo_bpm);
              writeDom("#creation-key", derived.key);
              writeDom("#creation-duration", derived.duration_secs);
              writeDom("#creation-language", derived.language);
              writeDom("#creation-work-type", derived.work_type);
              writeDom("#creation-instrumentation", derived.instrumentation);
              writeDom("#creation-vocal-style", derived.vocal_style);
              writeDom("#creation-ensemble", derived.ensemble_style);
              writeDom("#creation-license", derived.licensed_style_pack);
              writeDom("#creation-adapter", derived.external_audio_adapter);
              writeDom("#creation-arrangement-density", derived.arrangement_density);
              writeDom("#creation-dynamics-curve", derived.dynamics_curve);
              writeDom("#creation-section-form", derived.section_form);
              writeDom("#creation-articulation", derived.articulation_bias);
              writeDom("#creation-register", derived.voicing_register);
              writeDom("#creation-percussion", derived.percussion_activity);
              writeDom("#creation-expression-cc", derived.expression_cc_bias);
              writeDom("#creation-humanization", derived.humanization);
              writeDom("#creation-inspiration", derived.inspiration_notes);
              writeDom("#creation-reference-atlas", derived.reference_artists || derived.reference_atlas);
              if (derived.default_listen_price_cents != null) {
                const dollars = (Number(derived.default_listen_price_cents) / 100).toFixed(2);
                writeDom("#creation-default-listen", dollars);
              } else if (derived.default_listen_price_usd != null) {
                writeDom("#creation-default-listen", Number(derived.default_listen_price_usd).toFixed(2));
              }
              writeDom("#creation-current-universe", derived.current_universe || derived.civilization_summary);
              console.info(
                "%c[mv-pipeline][derive-from-user-lyrics] echoed derived_settings into Advanced Settings inputs",
                "color:#0c0;font-weight:bold"
              );
              try { globalThis.renderAdvancedSettingsModule?.(); } catch (_e) {}
              try { globalThis.syncCreationStateToLegacyInputs?.(); } catch (_e) {}
            } catch (_applyErr) {
              console.warn("[mv-pipeline][derive-from-user-lyrics] apply failed:", _applyErr);
            }
          } catch (_deriveErr) {
            console.warn("[mv-pipeline][derive-from-user-lyrics] LLM call failed (non-fatal):", _deriveErr);
          }
        })();
        // P2-31: syncWatchOutputs lifted to dispatchStageEvents("lyrics").
        return {
          lyrics: state.lyrics,
          // sections/shotScripts/title arrive async from the derive IIFE
          // (preserved fire-and-forget behavior). Don't include them in the
          // sync output — applyStageOutput would clobber the eventual async
          // assignments otherwise.
          userProvided: true,
          engineRecord: {
            engine: "user",
            version: "manual",
            provider_model: null,
            cost_cents: 0,
            input_tokens: null,
            output_tokens: null,
          },
          cost_cents: 0,
        };
      }
      } // end runLyricsStage

      // Stage 3 — music
      // CSSOS_MV_DAG_WAVE_2_7B 20260507 — body lifted into runMusicStage()
      // so both legacy IIFE path and DAG executor path can call it.
      // CSSOS_MV_DAG_WAVE_7C 20260508 — pure-helper refactor:
      //   • returns { audioUrl, audioUrlBackendOnly?, duration, alignedLyrics?,
      //     karaJson?, title?, _resp, cost_cents } so caller can sequence
      //     applyStageOutput + recordEngine + dispatchStageEvents +
      //     setStage("done") deterministically.
      //   • setStage / recordEngine / final syncWatchOutputs are owned by
      //     the DAG callback.
      //   • Helper still mutates state.audioUrl / duration / alignedLyrics
      //     INLINE because downstream DOM closures inside the helper
      //     (audio probe, audio prime, take-toggle injection, karaoke
      //     timeline cache seed, take-2 dual-track block) all read these
      //     fields synchronously. applyStageOutput re-applies the same
      //     values from the envelope — idempotent.
      //   • Closure-bound state mutations stay inline by design:
      //       - state.targetDurationSecs (compose-stage fallback)
      //       - state.altAudioUrl / altDuration (dual-track Take 2)
      //       - state.tierCapSecs / userTier (cap-toast)
      //       - state.currentTake / loopMode / _switchToTake / _cycleLoopMode
      //         (closures reference each other)
      //       - cssos:title_resolved (depends on activePipelineRunId)
      //       - watchKaraokeTimelineCache seed (DOM-bound; produces karaJson
      //         which we additionally surface in the return envelope)
      async function runMusicStage(state, _opts) {
      if (STAGE_ORDER.indexOf("music") >= resumeStartIdx) {
      // CSSOS_PHASE2_TARGET_DURATION 20260426 #148-C — Jing
      // "京典模板10节歌词，输出的音乐一般在5分钟左右，现在只有30秒。"
      //
      // Estimate target duration from lyric structure so the music engine
      // generates a track that actually accommodates all the lyrics. We
      // count lyric content lines (skipping section markers like
      // [Verse 1] / **Chorus** / blank separators) and assume ~3.5s per
      // line at typical singing tempo (a verse line with 8-10 syllables
      // sung at 90-110 BPM lands in 3-4 seconds).
      //
      // Floor: 30s (engine min). Ceiling: 300s (ElevenLabs max single
      // call). Pure-instrumental requests use a 90s default — the user's
      // full attention isn't on lyric coverage there.
      let _targetSecs = null;
      try {
        const lyricLines = String(state.lyrics || "")
          .split(/\r?\n/)
          .map(function (s) { return s.trim(); })
          .filter(function (s) {
            if (!s) return false;
            // Skip section markers / parentheticals / asterisk-wrapped
            const stripped = s
              .replace(/^[\*\[\(]+/, "")
              .replace(/[\*\]\)]+$/, "")
              .trim()
              .toLowerCase();
            if (!stripped) return false;
            return ![
              "verse", "verse 1", "verse 2", "verse 3", "verse 4", "verse 5",
              "chorus", "bridge", "outro", "intro", "pre-chorus", "hook"
            ].includes(stripped);
          })
          .length;
        if (lyricLines > 0) {
          const SECS_PER_LINE = 3.5;
          // Add a 12s buffer for intro/outro instrumental.
          _targetSecs = Math.round(lyricLines * SECS_PER_LINE + 12);
          // CSSOS_PHASE2_LONG_SONG 20260428 #168.1 — Jing
          // "我曾在Suno用Extend一首歌到6:30分钟" — bump cap from 300 (5 min)
          // to 600 (10 min) so opera / triptych / film-script lyrics
          // render their full natural length. Backend per-engine adapters
          // re-clamp to whichever maximum each engine supports.
          _targetSecs = Math.max(30, Math.min(_targetSecs, 600));
        } else {
          // CSSOS_PHASE2_INSTRUMENTAL_FULL 20260428 #168.1 — Jing said
          // "歌词需要有多少分钟，就应该有多少分钟" — even instrumental
          // shouldn't be a 90s blip; default to 180s = 3 min minimum.
          _targetSecs = 180;
        }
        console.info(
          "%c[mv-pipeline][music] target_duration=%ds (lyric_lines=%d)",
          "color:#08f;font-weight:bold",
          _targetSecs,
          lyricLines
        );
      } catch (_durErr) {
        console.warn("[mv-pipeline][music] duration estimate failed, falling back to engine default:", _durErr);
        _targetSecs = null;
      }
      // CSSOS_PHASE2_MUSIC_STYLE_ENRICH 20260429 #186 — Jing
      // "我们高级设置面板里的所有那些参数，都编进去了吗？"
      // Pull every Advanced-Settings DOM input that informs the music
      // engine and concatenate into the `music_style` text so the
      // sidecar's positive_global_styles array sees them. Skip empty
      // fields. Order matters: genre first (sets the family), then
      // tempo/key (musical anchor), then ensemble/instrumentation
      // (timbral palette), then voice attributes, then dynamics nuance.
      const _enrichMusicStyle = () => {
        // CSSOS_PHASE2_STYLE_NOISE_FILTER 20260430 #213 — Jing
        // Several Advanced-Settings fields default to literally "1" or
        // "Verse 1" when the LLM derive step couldn't infer a real value.
        // Emitting "1 arrangement, Verse 1 form, 1 humanization" into the
        // Suno style field caused V5 to interpret the song as a one-section
        // Verse-1 demo and stop after ~40s. Filter those noise values out.
        const isNoise = (raw) => {
          const t = String(raw || "").trim();
          if (!t) return true;
          if (t.toLowerCase() === "auto") return true;
          if (t.startsWith("creation.option")) return true;
          // Pure single number ("1", "2"): meaningless density indicator.
          if (/^\d{1,2}$/.test(t)) return true;
          // "Verse 1", "Section 1", "Chorus 1": auto-derive placeholder
          // (the lyrics will already imply the actual structure).
          if (/^(verse|section|chorus|bridge|intro|outro|hook)\s*\d*$/i.test(t)) {
            return true;
          }
          return false;
        };
        const readVal = (id) => {
          const el = document.getElementById(id);
          if (!el) return "";
          const v = String(el.value || el.textContent || "").trim();
          return isNoise(v) ? "" : v;
        };
        const parts = [];
        const baseStyle = String(state.style || "").trim();
        if (baseStyle) parts.push(baseStyle);
        // CSSOS_PHASE2_STYLE_FROM_LYRICS 20260430 #213 — Jing
        // Detect actual song structure from the lyrics' bracket markers
        // (`[Verse]`, `[Chorus]`, `[Bridge]`, `[Act I]`, `[Scene I]`, etc.)
        // and emit a real form descriptor like "Verse-Chorus-Bridge form"
        // — much better than a hardcoded "Verse 1 form" placeholder.
        try {
          const lyricsText = String(state.lyrics || "");
          const sectionMarkers = (lyricsText.match(/\[([^\]\n]{1,40})\]/g) || [])
            .map((m) => m.slice(1, -1).trim().toLowerCase())
            .map((s) => {
              if (/^verse/.test(s)) return "Verse";
              if (/^chorus/.test(s)) return "Chorus";
              if (/^bridge/.test(s)) return "Bridge";
              if (/^pre[-\s]?chorus/.test(s)) return "Pre-Chorus";
              if (/^post[-\s]?chorus/.test(s)) return "Post-Chorus";
              if (/^hook/.test(s)) return "Hook";
              if (/^intro/.test(s)) return "Intro";
              if (/^outro/.test(s)) return "Outro";
              if (/^interlude/.test(s)) return "Interlude";
              return "";
            })
            .filter(Boolean);
          // Dedupe consecutive duplicates (Verse Verse Chorus → Verse Chorus)
          // and dedupe overall to make a clean form descriptor.
          const uniqueOrdered = [...new Set(sectionMarkers)];
          if (uniqueOrdered.length >= 2) {
            parts.push(uniqueOrdered.join("-") + " form");
          }
        } catch (_e) { /* lyric parsing best-effort */ }
        const language = readVal("creation-language");
        if (language) parts.push(language + " vocals");
        const bpm = readVal("creation-tempo");
        if (bpm) parts.push(bpm + " BPM");
        const key = readVal("creation-key");
        if (key) parts.push(key + " key");
        const voiceGender = readVal("creation-voice-gender") || readVal("voice-input");
        if (voiceGender) parts.push(voiceGender.toLowerCase() + " lead vocal");
        const vocalStyle = readVal("creation-vocal-style");
        if (vocalStyle) parts.push(vocalStyle);
        const ensemble = readVal("creation-ensemble") || readVal("creation-ensemble-style");
        if (ensemble) parts.push(ensemble);
        const instrumentation = readVal("creation-instrumentation");
        if (instrumentation) parts.push(instrumentation);
        const percussion = readVal("creation-percussion");
        if (percussion) parts.push(percussion + " percussion");
        const arrangementDensity = readVal("creation-arrangement-density");
        if (arrangementDensity) parts.push(arrangementDensity + " arrangement");
        const dynamicsCurve = readVal("creation-dynamics-curve");
        if (dynamicsCurve) parts.push(dynamicsCurve + " dynamics");
        const articulation = readVal("creation-articulation");
        if (articulation) parts.push(articulation + " articulation");
        const register = readVal("creation-register");
        if (register) parts.push(register + " register");
        const sectionForm = readVal("creation-section-form");
        if (sectionForm) parts.push(sectionForm + " form");
        const expressionCc = readVal("creation-expression-cc");
        if (expressionCc) parts.push("expression: " + expressionCc);
        const humanization = readVal("creation-humanization");
        if (humanization) parts.push(humanization + " humanization");
        const inspiration = readVal("creation-inspiration");
        if (inspiration) parts.push("inspired by " + inspiration);
        // Dedupe while preserving order; cap total to ~2000 chars (was
        // 600 — Jing #187 wants room for many positive_global_styles
        // entries on long-form pieces). ElevenLabs Music's prompt window
        // tolerates ~4k easily; 2000 leaves headroom + a safety belt
        // against pathological enrichment of every field.
        const seen = new Set();
        const deduped = [];
        for (const p of parts) {
          const key = p.toLowerCase();
          if (!seen.has(key)) {
            seen.add(key);
            deduped.push(p);
          }
        }
        const joined = deduped.join(", ");
        return joined.length > 2000 ? joined.slice(0, 2000) : joined;
      };
      const _enrichedStyle = _enrichMusicStyle();
      console.info(
        "%c[mv-pipeline][music] enriched style → %s",
        "color:#08f", _enrichedStyle.slice(0, 200) + (_enrichedStyle.length > 200 ? "…" : "")
      );
      // CSSOS_PHASE2_MAKE_INSTRUMENTAL_TOGGLE 20260429 #188 — Jing
      // "make_instrumental 请在高级设置面板才参数开关". Read it from
      // the new checkbox in Advanced Settings; default off so existing
      // behaviour stays the same when the user never touches it.
      const _instrumentalCheckbox = document.getElementById("creation-make-instrumental");
      const _makeInstrumental = !!(_instrumentalCheckbox && _instrumentalCheckbox.checked);
      const _musicPayload = withEngine("music", {
        prompt: state.prompt,
        music_style: _enrichedStyle || state.style || null,
        lyrics: _makeInstrumental ? null : state.lyrics,
        make_instrumental: _makeInstrumental,
        // CSSOS_PHASE2_KIE_TITLE 20260429 #207 — Jing
        // Pass the user's actual song title to Suno. Without this the
        // backend was deriving title from prompt's first line, which Suno
        // treats as a strong style/voice hint — bad titles tilted the
        // arrangement off (Mount Hermon Oath rendered as a generic
        // "battle anthem"-titled track). Empty title → backend falls
        // back to prompt-derived; either way the field is plumbed.
        title: String(state.title || "").trim() || null
      });
      if (_targetSecs && _targetSecs > 0) {
        _musicPayload.target_duration_secs = _targetSecs;
        // CSSOS_PHASE2_PRESERVE_TARGET_DURATION 20260429 #176 — Jing
        // "3分多钟的那个媒体呢？请接进来"
        // Stash the lyric-derived target duration so the compose stage
        // can fall back to it when ElevenLabs returns duration_secs=null
        // (sync-binary path). Without this, compose plans 60s slideshow
        // and ffmpeg -shortest cuts the actual 226s audio to 60s.
        state.targetDurationSecs = _targetSecs;
      }
      const music = await postJson("/api/mv/music", _musicPayload);
      // CSSOS_PHASE2_FILE_URL_GUARD 20260426 #144 — Jing
      // "Not allowed to load local resource: file:///tmp/cssos-music/eleven-sync-..."
      // ElevenLabs sync stage delivers a backend-local file:// path. The
      // backend's compose pipeline handles file:// (#124), but the FRONTEND
      // <audio> element rejects file:// URLs as a security violation. If
      // the engine returns file://, suppress it from frontend playback —
      // the compose step still has the file path for ffmpeg, but the user
      // doesn't try to play raw file:// from a webpage.
      const _rawAudioUrl = String(music.audio_url || "").trim();
      if (_rawAudioUrl.startsWith("file://")) {
        console.warn(
          "[mv-pipeline] music engine returned file:// URL — frontend " +
          "cannot play this directly. Compose stage will still consume " +
          "it via the backend file-aware download path. URL:", _rawAudioUrl
        );
        // Keep the path internally for compose payload, expose empty to
        // any frontend player that would otherwise try to fetch it.
        state.audioUrlBackendOnly = _rawAudioUrl; // for compose() payload
        state.audioUrl = ""; // prevents <audio>.src = file:// CORS/security trap
      } else {
        state.audioUrl = _rawAudioUrl;
        state.audioUrlBackendOnly = null;
      }
      state.duration = Number(music.duration_secs || 0);
      // CSSOS_PHASE2_AUDIO_PROBE 20260430 #217 — Jing
      // "frontend slideshow planner 反向延展（音频更长时不再 freeze 最后一帧）"
      // The slideshow planner already targets state.duration when computing
      // segment counts, so reverse-extend math is correct in the common
      // path. The one residual case where video < audio: ElevenLabs
      // sync-binary returns duration_secs=null, leaving state.duration=0
      // and falling back to a 200s default that may not match the actual
      // mp3. As a safety net, asynchronously load the audio's metadata
      // and patch state.duration if it differs by >2s — ffmpeg will then
      // get a planner output that matches the real audio length.
      try {
        if ((!state.duration || state.duration < 2) && state.audioUrl) {
          const probe = new Audio();
          probe.preload = "metadata";
          probe.src = state.audioUrl;
          probe.addEventListener("loadedmetadata", () => {
            const measured = Number(probe.duration || 0);
            if (measured > 2 && Math.abs((state.duration || 0) - measured) > 2) {
              console.info(
                "%c[mv-pipeline][audio-probe] patched state.duration: %s → %s (engine reported missing/short)",
                "color:#08f",
                String(state.duration || 0).slice(0, 6),
                measured.toFixed(2)
              );
              state.duration = measured;
            }
          }, { once: true });
        }
      } catch (_e) { /* metadata probe best-effort */ }
      // CSSOS_PHASE2_KEEP_HEURISTIC_TITLE 20260504 — Jing
      // "进度条下面的 music，就不要再显示旧的 prompt 做标题，而是提炼
      //  出来的新标题".
      // The heuristic title-extractor (or LLM-derive) already filled
      // state.title with a short, human-readable title (e.g. "KN" from
      // a long instruction prompt). Suno's response.music.title is
      // sometimes the long prompt verbatim — overwriting state.title
      // with it would re-pollute every downstream surface (Watch
      // banner, music card, work record). Only adopt Suno's title
      // when our state.title is empty.
      if (!String(state.title || "").trim()) {
        state.title = String(music.title || "").trim();   // P2-31: capture title for Watch editors
      }
      // CSSOS_PHASE2_DUAL_TRACK 20260430 #208 — Jing
      // Capture Take 2 (Suno returns 2 clips per generation). Watch panel
      // surfaces a toggle so users can A/B between takes without paying
      // for a second generation. Single-track engines leave alt_audio_url
      // null and the toggle is hidden.
      const _altUrl = String(music.alt_audio_url || "").trim();
      if (_altUrl && !_altUrl.startsWith("file://")) {
        state.altAudioUrl = _altUrl;
        // CSSOS_PHASE2_TAKE2_BACKSTOP 20260501 #254 — Jing
        // "刚才第一对歌的第二首歌没有播放就直接进入第二对歌."
        // Suno often returns alt_duration_secs=0/null. Fall back to
        // Take 1's duration (Suno takes are typically same length) so
        // the take-switch backstop has a sane upper bound. Without this
        // the backstop falls back to a 60s minimum and prematurely
        // advances during a 3-minute Take 2.
        state.altDuration = Number(
          music.alt_duration_secs || music.duration_secs || 0
        );
      } else {
        state.altAudioUrl = "";
        state.altDuration = 0;
      }
      // CSSOS_PHASE2_PRIME_PIPELINE_AUDIO 20260430 #240 — Jing
      // "万能入口们输出完2首歌，播完第一首，进入第二首的时候，没有声音,
      //  必须手动点一下。请修复，不需要点击."
      //
      // Pipeline-generated output: when the music stage finishes we have
      // both Take 1 (state.audioUrl) and Take 2 (state.altAudioUrl) URLs.
      // The video element is the one that auto-plays (with Take 1 baked
      // in), but the <audio> element is never user-activated. By the
      // time Take 1 ends and switchToTake(2) calls audio.play(), the
      // browser treats it as a fresh-element first-play and rejects.
      //
      // Fix: prime the <audio> element NOW (we still have sticky user
      // activation from the "Start Pipeline" click), with src=Take 1 +
      // muted=true + play(). Once it's been play()'d once, future src
      // swaps + unmutes work without an autoplay prompt. The MUTED play
      // is also explicitly allowed by every browser regardless of
      // gesture state, so this can't fail silently.
      // CSSOS_PHASE2_PRIME_NO_MUTE 20260501 #256 — Jing
      // "为什么也默认静音音乐呢？请修复，无论是在什么环境中..."
      //
      // Don't preemptively mute the video. Safari silently resolves
      // audio.play() with muted=true then pauses the element when we
      // unmute it without a fresh user gesture — the result is total
      // silence (video muted + audio paused).
      //
      // New strategy: video plays Take 1 with its baked-in audio
      // (the engine ALWAYS includes Take 1 in the MP4). The <audio>
      // element gets PRIMED with Take 1 URL + muted play(), but we
      // never unmute it on Take 1. Switching to Take 2 is the only
      // path that mutes the video and unmutes the audio element —
      // and that path always runs from a fresh user gesture (click
      // on ♪2 pill, or ended event in an already-active gesture
      // chain), so Safari is happy.
      try {
        if (state.audioUrl && !String(state.audioUrl).startsWith("file://")) {
          const audioEl = document.getElementById("watch-audio-preview");
          if (audioEl) {
            audioEl.src = state.audioUrl;
            audioEl.muted = true; // stays muted on Take 1; user hears video
            audioEl.load && audioEl.load();
            const primePromise = audioEl.play && audioEl.play();
            if (primePromise && typeof primePromise.then === "function") {
              primePromise.catch(() => {}); // silent prime; video has the sound
            }
          }
        }
      } catch (_primeErr) { /* prime best-effort */ }
      // Inject / refresh the Take 1 / Take 2 toggle in the Watch panel.
      try {
        const watchScreen = document.querySelector(".watch-frame .watch-screen") || document.getElementById("watch-panel");
        if (watchScreen && state.altAudioUrl) {
          let toggle = document.getElementById("watch-take-toggle");
          if (!toggle) {
            toggle = document.createElement("div");
            toggle.id = "watch-take-toggle";
            toggle.style.cssText =
              "position:absolute;top:12px;right:12px;display:flex;gap:4px;" +
              "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
              "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
              "padding:3px;z-index:30;font-size:12px;font-weight:600;letter-spacing:.04em;";
            const mkBtn = (label, take) => {
              const b = document.createElement("button");
              b.type = "button";
              b.dataset.take = String(take);
              b.textContent = label;
              b.style.cssText =
                "background:transparent;color:rgba(255,255,255,0.65);" +
                "border:none;padding:6px 14px;border-radius:999px;" +
                "cursor:pointer;transition:all .15s ease;";
              b.addEventListener("click", () => {
                try { switchToTake(take); } catch (e) { console.warn("[take-toggle]", e); }
              });
              // CSSOS_PHASE2_LOOP_MENU 20260430 #208 — right-click cycles
              // loop modes for that take (off → single → both takes).
              b.addEventListener("contextmenu", (ev) => {
                ev.preventDefault();
                try { cycleLoopMode(take); } catch (e) { console.warn("[take-loop]", e); }
              });
              return b;
            };
            // CSSOS_PHASE2_DUAL_TRACK 20260430 #227 — Jing
            // "请在后台去掉这些'Take 2'。这是单曲，先循环自己的两首,
            //  再播放别人的." Drop the "Take" framing — to the user
            // these are simply two songs that share a title and play
            // back-to-back. Labels become "♪ 1" / "♪ 2".
            toggle.appendChild(mkBtn("♪ 1", 1));
            toggle.appendChild(mkBtn("♪ 2", 2));
            watchScreen.style.position = watchScreen.style.position || "relative";
            watchScreen.appendChild(toggle);
          }
          // Highlight active take.
          const active = state.currentTake || 1;
          toggle.querySelectorAll("button").forEach((b) => {
            const isActive = Number(b.dataset.take) === active;
            b.style.background = isActive ? "rgba(0,245,160,0.25)" : "transparent";
            b.style.color = isActive ? "#00f5a0" : "rgba(255,255,255,0.65)";
          });
        }
      } catch (_e) { /* toggle injection best-effort */ }
      // Helper closures hoisted onto state for context-menu reuse.
      // CSSOS_PHASE2_DUAL_TRACK 20260430 #228 — Jing
      // "胶囊已经显示 ♪ 1 / ♪ 2 切换，但是切换之后，没有自动播放。
      //  严格说自动播放了画面，但是没有自动播放音频."
      // Audio comes from <audio> only; video is always muted.
      // play() rejection (autoplay policy in ended-event handler) is
      // surfaced via console + toast + one-tap recover instead of being
      // swallowed silently.
      const switchToTake = (take) => {
        const url = take === 2 ? state.altAudioUrl : state.audioUrl;
        if (!url) {
          if (typeof globalThis.showToast === "function") {
            const _lc = (typeof loginCopy === "function" ? loginCopy : (en) => en);
            globalThis.showToast(_lc(`♪ ${take} unavailable for this work.`,
                                     `♪ ${take} 暂不可用。`));
          }
          return;
        }
        state.currentTake = take;
        const audioEl = document.getElementById("watch-audio-preview");
        const videoEl = document.getElementById("watch-video");
        // CSSOS_PHASE2_TAKE_SHARE_VIDEO 20260501 #258 — Jing
        // "歌1，歌2复用同一个画面同一个视频." Same MP4 plays for both
        // takes — only audio differs. Restart from start so visuals
        // play fresh through Take 2 instead of freezing on final frame.
        if (videoEl) {
          try { videoEl.currentTime = 0; } catch (_e) {}
          videoEl.muted = take === 2;
          videoEl.play && videoEl.play().catch(() => {});
        }
        if (audioEl) {
          const sameSrc = audioEl.src && audioEl.src.endsWith(url);
          if (!sameSrc) {
            audioEl.src = url;
            audioEl.load && audioEl.load();
          }
          audioEl.muted = false;
          try {
            const t = videoEl ? Number(videoEl.currentTime || 0) : 0;
            if (Number.isFinite(t) && t > 0 && !sameSrc) {
              audioEl.currentTime = Math.min(t, audioEl.duration || t);
            }
          } catch (_e) {}
          if (audioEl.play) {
            audioEl.play().catch((err) => {
              console.warn("[take-switch] audio.play() rejected:", err);
              if (typeof globalThis.showToast === "function") {
                const _lc = (typeof loginCopy === "function" ? loginCopy : (en) => en);
                globalThis.showToast(_lc(`♪ ${take} ready — tap the panel to start.`,
                                         `♪ ${take} 已就绪 — 点击面板继续。`));
              }
              const recover = () => {
                audioEl.play && audioEl.play().catch(() => {});
                document.removeEventListener("click", recover, true);
              };
              document.addEventListener("click", recover, true);
            });
          }
        }
        // Refresh toggle highlight.
        const toggle2 = document.getElementById("watch-take-toggle");
        if (toggle2) {
          toggle2.querySelectorAll("button").forEach((b) => {
            const a = Number(b.dataset.take) === take;
            b.style.background = a ? "rgba(0,245,160,0.25)" : "transparent";
            b.style.color = a ? "#00f5a0" : "rgba(255,255,255,0.65)";
          });
        }
        if (typeof globalThis.showToast === "function") {
          const _lc = (typeof loginCopy === "function" ? loginCopy : (en) => en);
          globalThis.showToast(_lc(`♪ ${take} playing.`, `正在播放 ♪ ${take}`));
        }
      };
      const cycleLoopMode = (take) => {
        const audioEl = document.getElementById("watch-audio-preview");
        const videoEl = document.getElementById("watch-video");
        // Modes: off → single (loop current) → both (cycle Take 1 & Take 2)
        const next = ((state.loopMode | 0) + 1) % 3;
        state.loopMode = next;
        const labels = ["loop off", "loop single", "loop both takes"];
        if (audioEl) {
          audioEl.loop = (next === 1); // single-track loop
          // For "both takes" we hook audio.ended to swap.
          if (next === 2) {
            audioEl.loop = false;
            const swap = () => {
              const otherTake = (state.currentTake === 2) ? 1 : 2;
              if (state.loopMode === 2 && state.altAudioUrl) {
                switchToTake(otherTake);
              }
            };
            audioEl.removeEventListener("ended", state._loopBothHandler || (() => {}));
            state._loopBothHandler = swap;
            audioEl.addEventListener("ended", swap);
          } else if (state._loopBothHandler) {
            audioEl.removeEventListener("ended", state._loopBothHandler);
            state._loopBothHandler = null;
          }
        }
        if (videoEl) {
          videoEl.loop = (next === 1);
        }
        if (typeof globalThis.showToast === "function") {
          globalThis.showToast(labels[next]);
        }
      };
      state._switchToTake = switchToTake;
      state._cycleLoopMode = cycleLoopMode;
      // Bridge to watch-ui.js (ArrowUp/ArrowDown + touch swipe).
      try {
        globalThis.__cssosWatchTakeSwitcher = switchToTake;
        globalThis.__cssosWatchLoopCycler = cycleLoopMode;
        globalThis.cssosMvPipelinePanelState = () => state;
      } catch (_e) { /* globalThis bridge best-effort */ }
      // CSSOS_PHASE2_DUAL_TRACK 20260430 #229 — Jing
      // "媒体框右上角的♪1 ♪2不显示了。请修复。" Hoist a reusable
      // injector that watch-ui's queue-advance and market-commerce's
      // card-click paths can both call (the original injection only
      // ran inside the pipeline music handler — saved-work playback
      // never re-rendered the toggle). Uses the existing global
      // bridges so the click handlers always wire to the live
      // switchToTake / cycleLoopMode closures.
      try {
        globalThis.__cssosInjectTakeToggle = function(opts) {
          const altUrl = String(opts?.altAudioUrl || "").trim();
          const watchScreen =
            document.querySelector(".watch-frame .watch-screen") ||
            document.getElementById("watch-panel");
          if (!watchScreen) return;
          let toggle = document.getElementById("watch-take-toggle");
          if (!altUrl) {
            // No second take for this work — strip the toggle entirely.
            if (toggle && toggle.parentNode) toggle.parentNode.removeChild(toggle);
            return;
          }
          if (!toggle) {
            toggle = document.createElement("div");
            toggle.id = "watch-take-toggle";
            toggle.style.cssText =
              "position:absolute;top:12px;right:12px;display:flex;gap:4px;" +
              "background:rgba(0,0,0,0.55);backdrop-filter:blur(8px);" +
              "border:1px solid rgba(255,255,255,0.18);border-radius:999px;" +
              "padding:3px;z-index:30;font-size:12px;font-weight:600;letter-spacing:.04em;";
            const mkBtn = (label, take) => {
              const b = document.createElement("button");
              b.type = "button";
              b.dataset.take = String(take);
              b.textContent = label;
              b.style.cssText =
                "background:transparent;color:rgba(255,255,255,0.65);" +
                "border:none;padding:6px 14px;border-radius:999px;" +
                "cursor:pointer;transition:all .15s ease;";
              b.addEventListener("click", () => {
                try {
                  const sw = globalThis.__cssosWatchTakeSwitcher;
                  if (typeof sw === "function") sw(take);
                } catch (e) { console.warn("[take-toggle]", e); }
              });
              b.addEventListener("contextmenu", (ev) => {
                ev.preventDefault();
                try {
                  const cyc = globalThis.__cssosWatchLoopCycler;
                  if (typeof cyc === "function") cyc(take);
                } catch (e) { console.warn("[take-loop]", e); }
              });
              return b;
            };
            toggle.appendChild(mkBtn("♪ 1", 1));
            toggle.appendChild(mkBtn("♪ 2", 2));
            watchScreen.style.position = watchScreen.style.position || "relative";
            watchScreen.appendChild(toggle);
          }
          // Highlight active take.
          const active = Number(opts?.currentTake || 1);
          toggle.querySelectorAll("button").forEach((b) => {
            const isActive = Number(b.dataset.take) === active;
            b.style.background = isActive ? "rgba(0,245,160,0.25)" : "transparent";
            b.style.color = isActive ? "#00f5a0" : "rgba(255,255,255,0.65)";
          });
        };
      } catch (_e) { /* injector hoist best-effort */ }
      // CSSOS_PHASE2_TIER_DURATION_CAP 20260430 #209 — Jing
      // Surface the membership cap so the Watch UI can show
      // "your X-min ceiling — upgrade to extend" if the user hit it.
      state.tierCapSecs = Number(music.tier_cap_secs || 0);
      state.userTier = String(music.user_tier || "").trim();
      try {
        if (typeof globalThis.showToast === "function" && state.tierCapSecs > 0 && state.duration > 0) {
          const epsilon = 2; // seconds — Suno often lands within ±1s of the cap
          if (Math.abs(state.duration - state.tierCapSecs) <= epsilon) {
            globalThis.showToast(
              `Hit your ${Math.round(state.tierCapSecs/60)}-min ${state.userTier || "membership"} cap — upgrade to extend.`
            );
          }
        }
      } catch (_e) { /* toast best-effort */ }
      // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
      // "音乐引擎渲染音乐的时候，是否正确并且同时输出带有时间戳的歌词时间轴
      //  json？不然字幕无法渲染。" — Suno + ElevenLabs both expose per-line
      // timing. Capture into state so the subtitles stage can pass them
      // through to /api/mv/subtitles for real-timing SRT generation.
      // Engines that don't emit alignment (MusicGPT, Stable Audio, ElevenLabs
      // sync-binary path) leave this null and the backend falls back to
      // the legacy even-divide algorithm — no regression for those flows.
      const _aligned = Array.isArray(music.aligned_lyrics) ? music.aligned_lyrics : null;
      state.alignedLyrics = (_aligned && _aligned.length > 0) ? _aligned : null;
      console.info(
        "[mv-pipeline][music] aligned_lyrics: %s (engine=%s)",
        state.alignedLyrics ? state.alignedLyrics.length + " lines" : "none",
        music.engine || "?"
      );
      // CSSOS_PHASE2_KARAOKE_TIMELINE_SEED 20260429 #168.8 — Jing
      // "字幕也还没有对齐，只显示第一行，就停了 ... 应该是音乐时长有
      //  多长，就应该渲染字幕多长."
      //
      // Watch panel reads `watchKaraokeTimelineCache.data` for cue
      // rendering. The cache loader tries to fetch
      // ./build/karaoke.timeline.json from the LEGACY creative-engine
      // run dir — MV Pipeline doesn't write that file. So the timeline
      // stays null and the karaoke overlay falls through to first-line-
      // only. Seed the cache directly from `state.alignedLyrics` (the
      // music engine's per-line timing) OR from a synthetic even-divide
      // fallback over the music duration when the engine didn't emit
      // alignment (MusicGPT, ElevenLabs sync-binary path, etc.).
      let _karaTimeline = null;
      try {
        const cache = globalThis.watchKaraokeTimelineCache;
        if (cache) {
          const runIdForCache = state.runId || state.taskId || `mv-${state.startedAt || Date.now()}`;
          let timeline = null;
          if (state.alignedLyrics && state.alignedLyrics.length > 0) {
            // Engine-emitted: { text, start_ms, end_ms, ... }
            timeline = state.alignedLyrics.map((line) => {
              const start_s = Number(
                line.start_s !== undefined ? line.start_s : (Number(line.start_ms || 0) / 1000)
              ) || 0;
              const end_s = Number(
                line.end_s !== undefined ? line.end_s : (Number(line.end_ms || 0) / 1000)
              ) || (start_s + 3);
              return {
                start_s,
                end_s: Math.max(start_s + 0.25, end_s),
                text: String(line.text || "").trim(),
              };
            }).filter((c) => c.text);
          } else if (state.lyrics) {
            // CSSOS_PHASE2_KARAOKE_SEED_ALWAYS 20260429 #168.8b — Jing
            // "字幕压根就没有显示."
            // ElevenLabs sync-binary path returns duration_secs=null so
            // state.duration is 0 here. Don't gate on duration — estimate
            // from line count × 3.5s/line + 8s intro/outro. Then when
            // <audio>.loadedmetadata fires (handler installed below) we
            // re-seed with the actual duration.
            const lines = String(state.lyrics)
              .split("\n")
              .map((s) => s.trim())
              // Drop section markers like [Verse 1] / [Chorus] — they
              // shouldn't appear in subtitles.
              .filter((s) => s && !/^\[.*\]$/.test(s) && !/^\(.*\)$/.test(s));
            if (lines.length > 0) {
              const total = state.duration > 0
                ? state.duration
                : (lines.length * 3.5 + 8);
              const step = total / lines.length;
              timeline = lines.map((text, i) => ({
                start_s: Number((i * step).toFixed(3)),
                end_s: Number(((i + 1) * step).toFixed(3)),
                text,
              }));
            }
          }
          if (timeline && timeline.length) {
            cache.runId = runIdForCache;
            cache.data = timeline;
            cache.error = "";
            cache.pending = false;
            _karaTimeline = timeline;
            console.info(
              "%c[mv-pipeline][karaoke-seed] seeded cache with %d cues spanning %.1fs",
              "color:#0a8;font-weight:bold",
              timeline.length,
              timeline[timeline.length - 1].end_s
            );
            // Kick a re-render so the bottom subtitle starts updating.
            try { globalThis.renderWatchKaraokeOverlayModule?.(); } catch (_e) {}
          }
        }
      } catch (_seedErr) {
        console.warn("[mv-pipeline][karaoke-seed] failed:", _seedErr);
      }
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
      // CSSOS_MV_DAG_WAVE_7C 20260508 — recordEngine + setStage("music","done")
      // + final syncWatchOutputs lifted into the DAG callback so the
      // helper is pure-output. The done-label is computed by the caller
      // from state.title + state.duration + state.altDuration.

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
      // CSSOS_MV_DAG_WAVE_7C 20260508 — pure-helper return envelope.
      // applyStageOutput re-applies these from state's perspective
      // (idempotent — helper already wrote them inline so DOM closures
      // above had access). Caller uses these for setStage("done") +
      // recordEngine sequencing.
      return {
        audioUrl: state.audioUrl,
        audioUrlBackendOnly: state.audioUrlBackendOnly,
        duration: state.duration,
        alignedLyrics: state.alignedLyrics,
        karaJson: _karaTimeline,
        title: state.title,
        _resp: music,
        cost_cents: Number(music.cost_cents || 0),
      };
      } // end Stage 3 (music) resume guard
      return null;
      } // end runMusicStage

      // Stage 4 — video
      // CSSOS_MV_DAG_WAVE_2_7C 20260507 — body lifted into runVideoStage()
      // CSSOS_MV_DAG_WAVE_7D 20260508 — pure-helper refactor:
      //   • returns { video_skipped?, skipReason?, video_url?, segments?,
      //     videoDurSecs?, _resp?, cost_cents } so caller can sequence
      //     applyStageOutput + recordEngine + dispatchStageEvents + setStage.
      //   • Returns null when STAGE_ORDER resume guard short-circuits.
      //   • Hard-failure path: helper still calls setStage("subtitles","error")
      //     and setStage("compose","error") and fallbackToMusicOnly, then
      //     throws an Error with __shortCircuit:"video" so the DAG executor
      //     marks downstream stages cancelled. Documented residual: those
      //     two cross-stage setStage calls cancel DOWNSTREAM stage UI when
      //     video hard-fails — they can't be lifted into apply/dispatch
      //     cleanly because the failure is signalled via throw, not a
      //     return value (DAG never invokes apply for failed nodes).
      async function runVideoStage(state) {
      let video = null;
      // CSSOS_PHASE2_LITE_SEGMENT_PLANNER 20260426 #47 — Jing
      // Lite tier is image-only by definition. Skipping /api/mv/video saves
      // ~$0.60 of Runway gen4_turbo per run. The compose call later routes
      // to the Ken-Burns-segments path so an empty state.videoUrl is fine.
      // Mark the video stage as `skipped` (not `error`) so the Watch panel
      // bar shows a clean done-skip instead of a red failure.
      if (STAGE_ORDER.indexOf("video") < resumeStartIdx) return null;
      let _liteSkipsVideo = false;
      try {
        if (globalThis.cssmvTiers && typeof globalThis.cssmvTiers.currentTierId === "function") {
          _liteSkipsVideo = String(globalThis.cssmvTiers.currentTierId() || "").toLowerCase() === "lite";
        }
      } catch (_e) { /* ignore */ }
      if (_liteSkipsVideo) {
        return { video_skipped: true, skipReason: "lite_tier", cost_cents: 0 };
      }
      {
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
      // CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E — Jing
      // When the lyrics LLM emitted shot_scripts (one per lyric section),
      // request multi-segment video generation. Backend runs N parallel
      // Runway calls and returns segments[]; compose stage xfade-chains
      // them into the final MV. Falls back to single-clip when shots
      // absent so older / fallback runs still work.
      const _videoBody = {
        prompt_image_url: state.coverUrl,
        prompt_text: state.prompt,
        duration_secs: clampedDuration,
        ratio: videoRatio,
        model: videoModel
      };
      if (state.shotScripts && state.shotScripts.length > 0) {
        // Per-segment duration: 5 or 10s, default 8 (round to nearest legal).
        const _segDur = clampedDuration; // re-use the clamp logic above
        _videoBody.shot_scripts = state.shotScripts;
        _videoBody.segment_duration_secs = _segDur;
        console.info(
          "%c[mv-pipeline][video] requesting %d-segment generation × %ds (total %ds)",
          "color:#0ff;font-weight:bold",
          state.shotScripts.length,
          _segDur,
          state.shotScripts.length * _segDur
        );
      }
      try {
        video = await withTimeout(
          postJson(
            "/api/mv/video",
            withEngine("video", _videoBody)
          ),
          VIDEO_TIMEOUT_MS,
          "video"
        );
      } catch (videoErr) {
        const videoErrorMsg = videoErr && videoErr.message ? videoErr.message : String(videoErr);
        console.warn("[mv-pipeline] video stage failed, falling back to music-only:", videoErr);
        // Tag the stage card so the user sees what happened.
        setStage(
          "video",
          "error",
          copy(
            "Video failed (" + videoErrorMsg + ") · playing music fallback",
            "视频失败（" + videoErrorMsg + "）· 已切换到音乐播放"
          ),
          0
        );
        // CSSOS_PHASE2_P2_54_NO_FAKE_GREEN 20260418 — Jing
        // Residual cross-stage UI cleanup: when video hard-fails, mark the
        // DOWNSTREAM subtitles + compose stage chips as error so the Watch
        // panel doesn't paint them green. Cannot be lifted into apply/dispatch
        // because the failure is signalled via thrown sentinel; DAG never
        // invokes apply for failed/cancelled nodes. Equivalent to the
        // executor's onStageError hook applied to subs + compose.
        state.engines = state.engines || {};
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
        fallbackToMusicOnly(copy(
          "Video timed out · playing music",
          "视频超时 · 播放音乐"
        ));
        renderSummary();
        const sentinel = new Error("__CSSMV_SHORT_CIRCUIT__:video:" + videoErrorMsg);
        sentinel.__shortCircuit = "video";
        throw sentinel;
      }

      // CSSOS_PHASE2_SHOT_SCRIPTS 20260426 #148-E — Jing
      const _segments = Array.isArray(video.segments) && video.segments.length >= 2
        ? video.segments
        : null;
      if (_segments) {
        console.info(
          "%c[mv-pipeline][video] received %d segments, total %ds AI video",
          "color:#0ff;font-weight:bold",
          _segments.length,
          _segments.reduce(function (a, s) { return a + Number(s.duration_secs || 0); }, 0)
        );
      }
      const _videoDurSecs =
        (video && Number(video.duration_secs) > 0)
          ? Number(video.duration_secs)
          : clampedDuration;
      return {
        video_skipped: false,
        video_url: video.video_url,
        segments: _segments,
        videoDurSecs: _videoDurSecs,
        cost_cents: video.cost_cents || 0,
        _resp: video
      };
      } // end runVideoStage primary block
      } // end runVideoStage

      // Stage 5 — subtitles (real /api/mv/subtitles call)
      // CSSOS_MV_DAG_WAVE_2_7C 20260507 — body lifted into runSubsStage().
      // CSSOS_MV_DAG_WAVE_7E 20260508 — pure-helper refactor:
      //   • returns { subtitlesSrt, subtitlesAss, _resp, lineCount, skipped,
      //     skipReason, cost_cents } so caller can sequence applyStageOutput +
      //     recordEngine + setStage deterministically.
      //   • setStage / recordEngine / state mutations are owned by the DAG
      //     callback. Returns null when the resume guard skips this stage.
      async function runSubsStage(state) {
        if (STAGE_ORDER.indexOf("subtitles") < resumeStartIdx) return null;
        // CSSMV_CONSOLE_CLEANUP 20260423 #88 — Jing: the only implemented
        // subtitles engine today is cssmv-local/srt-v1. If the user's picker
        // selected anything else, omit the engine so the backend falls back
        // to the stage default instead of returning 501 Not Implemented.
        const subtitlesBody = withEngine("subtitles", {
          lyrics: state.lyrics,
          duration_secs: state.duration || SUBTITLES_DEFAULT_DURATION_SECS,
          // CSSOS_PHASE2_ASS_OUTPUT 20260504 — Jing: pass title so the
          // ASS [Script Info] header can include it (purely cosmetic).
          title: String(state.title || "").trim() || undefined
        });
        // CSSOS_PHASE2_ALIGNED_LYRICS 20260426 #148-D — Jing
        if (state.alignedLyrics && state.alignedLyrics.length > 0) {
          subtitlesBody.aligned_lyrics = state.alignedLyrics;
          console.info(
            "%c[mv-pipeline][subtitles] sending %d aligned_lyrics lines for tight SRT",
            "color:#0a0;font-weight:bold",
            state.alignedLyrics.length
          );
        }
        if (subtitlesBody.engine && subtitlesBody.engine !== "cssmv-local") {
          delete subtitlesBody.engine;
          delete subtitlesBody.version;
        }
        try {
          const subs = await postJson("/api/mv/subtitles", subtitlesBody);
          return {
            subtitlesSrt: subs.srt || null,
            subtitlesAss: subs.ass || null,
            lineCount: subs.line_count || 0,
            engine: subs.engine || "",
            version: subs.version || "",
            cost_cents: subs.cost_cents || 0,
            _resp: subs,
            skipped: false
          };
        } catch (subErr) {
          // Subtitles are non-fatal: keep the pipeline going without them.
          return {
            subtitlesSrt: null,
            subtitlesAss: null,
            skipped: true,
            skipReason: subErr.message || "unknown",
            cost_cents: 0
          };
        }
      } // end runSubsStage

      // Stage 6 — compose
      // CSSOS_MV_DAG_WAVE_2_7C 20260507 — body lifted into runComposeStage().
      // CSSOS_MV_DAG_WAVE_7F 20260508 — pure-helper refactor:
      //   • returns { composed, public_url, mv_id, cost_cents, _resp } so
      //     caller can sequence applyStageOutput + recordEngine + setStage
      //     + dispatchStageEvents (kara_ready) deterministically.
      //   • Hard-failure path: helper still calls setStage("compose","error")
      //     and fallbackToMusicOnly + renderSummary, then throws an Error
      //     with __shortCircuit:"compose" so the DAG executor short-circuits.
      //   • Returns null when STAGE_ORDER resume guard short-circuits.
      //   • Post-compose autoplay / hot-swap / autosave (with run-finish
      //     dispatch) stays inside the helper — pure DOM manipulation, no
      //     state.* mutations except state.duration backfill from <audio>
      //     loadedmetadata (documented residual; async DOM-driven).
      async function runComposeStage(state) {
      //
      // P2-34: wrap in a hard timeout so a hung Rust ffmpeg mux does not
      // leave the UI stuck at "96%" forever. If compose times out, we
      // still proceed to the music-only fallback path below.
      // P2-24 Jing 2026-04-18: reuse the shared withTimeout helper and
      // gracefully fall back to music-only if compose fails/times out.
      if (STAGE_ORDER.indexOf("compose") < resumeStartIdx) return null;
      let composed = null;
      {
      setStage("compose", "running", "");
      const mvId = "mv_" + Date.now();
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
          // CSSOS_PHASE2_DURATION_FALLBACK 20260429 #176 — Jing
          // ElevenLabs sync-binary leaves state.duration=0 (no duration in
          // response). Without a fallback, the planner defaulted to 60s
          // and the 226s song got cut to 60s by ffmpeg -shortest. Use the
          // lyric-derived target duration we stashed before the music call
          // as the next-best fallback (it's what we asked Eleven for).
          durationSecs: state.duration > 1
            ? state.duration
            : (Number(state.targetDurationSecs) || 0),
          // CSSOS_PHASE2_HYBRID_MIXER 20260426 #132 — pass the AI clip URL
          // and its duration so Hybrid/Cinematic can splice it into the
          // timeline instead of leaving it on the cutting-room floor.
          aiVideoUrl: state.videoUrl,
          aiVideoDurSecs: state.videoDurSecs
        });
        const _composeBase = {
          mv_id: mvId,
          // CSSOS_PHASE2_FILE_URL_GUARD 20260426 #144 — when state.audioUrl
          // was zeroed because the engine returned file://, prefer the
          // backend-only path so the rust-api compose can still find it
          // via download_to's file:// branch (#124).
          audio_url: state.audioUrl || state.audioUrlBackendOnly || "",
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
        // CSSOS_PHASE2_AUDIO_LOG_CLARITY 20260426 #146 — Jing
        // The previous "audio=no" was misleading when audioUrlBackendOnly
        // held a file:// path. Distinguish three states:
        //   yes-https   → public URL goes to <audio> AND compose
        //   yes-file    → compose-only (file://, frontend can't play raw)
        //   no          → music stage failed entirely
        let _audioState = "no";
        if (state.audioUrl) _audioState = "yes-https";
        else if (state.audioUrlBackendOnly) _audioState = "yes-file";
        console.info(
          "[mv-pipeline][compose-decision] tier=%s · cover=%s · audio=%s · video=%s · videoDur=%s · plan=%s · segments=%s",
          _liteTierId,
          state.coverUrl ? "yes" : "no",
          _audioState,
          state.videoUrl ? state.videoUrl.slice(0, 80) + "…" : "no",
          state.videoDurSecs || 0,
          _litePlan ? _litePlan.plan : "none",
          _litePlan && _litePlan.segments ? _litePlan.segments.length : 0
        );
        // CSSOS_PHASE2_MULTI_SEGMENT 20260426 #148-G — Jing
        // When the video stage produced N segments (one per lyric section
        // via shot_scripts), build a true multi-clip timeline. This is the
        // Cinematic tier full-length MV path: each lyric section gets its
        // own AI clip, xfade-chained, with the music engine's full-length
        // audio + tight aligned-lyric SRT layered on top.
        //
        // Each AiVideo segment carries duration_secs from the Runway call's
        // requested length (5-10s) and a default fade transition. The
        // Cinematic case typically needs 5-12 sections × 8s = 40-96s of
        // AI video, looped/extended to match the full track length. When
        // total AI duration < audio duration, we fall through to the
        // existing _litePlan path so Ken Burns slides fill the gap.
        let _videoSegments = null;
        try {
          if (Array.isArray(state.videoSegments) && state.videoSegments.length >= 2) {
            const xfadeSecs = 1.2;
            _videoSegments = state.videoSegments.map(function (seg, idx) {
              return {
                kind: "ai_video",
                source_url: seg.video_url,
                duration_secs: Number(seg.duration_secs || 5),
                // Skip xfade on the very first segment.
                transition: idx === 0 ? null : "fade",
                transition_duration_secs: idx === 0 ? null : xfadeSecs
              };
            });
            const _totalAiSecs = _videoSegments.reduce(function (acc, s) {
              return acc + Number(s.duration_secs || 0);
            }, 0);
            const _audioSecs = Number(state.duration || 0);
            console.info(
              "%c[mv-pipeline][compose-decision] CINEMATIC multi-segment: " +
              _videoSegments.length + " AI clips × avg " +
              (_totalAiSecs / _videoSegments.length).toFixed(1) +
              "s = " + _totalAiSecs.toFixed(1) + "s of AI video " +
              "(audio=" + _audioSecs.toFixed(1) + "s)",
              "color:#0ff;font-weight:bold"
            );
            // If AI total < audio, append Ken Burns padding to cover the gap.
            if (_audioSecs > 0 && _totalAiSecs + 0.5 < _audioSecs && state.coverUrl) {
              const padSecs = _audioSecs - _totalAiSecs;
              _videoSegments.push({
                kind: "kenburns_image",
                source_url: state.coverUrl,
                duration_secs: padSecs,
                effect: "zoom_in",
                transition: "fade",
                transition_duration_secs: xfadeSecs
              });
              console.info(
                "[mv-pipeline][compose-decision] padded with Ken Burns cover for %ds",
                padSecs.toFixed(1)
              );
            }
          }
        } catch (_segBuildErr) {
          console.warn("[mv-pipeline] multi-segment compose build failed:", _segBuildErr);
          _videoSegments = null;
        }
        if (_videoSegments && _videoSegments.length >= 2) {
          _composeBase.segments = _videoSegments;
        } else if (_litePlan && _litePlan.segments && _litePlan.segments.length >= 2) {
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
        // CSSOS_PHASE2_COMPOSE_ETA_DYNAMIC 20260429 #183 — Jing
        // "Composing MV 总是卡在 99%". The progress curve plateaus at 99.5%
        // after ~6×etaSecs. With static etaSecs=180 a 23-segment xfade
        // chain (observed 213 s) plateaus exactly when the user notices
        // "stuck at 99%". Recompute eta from the real segment count we're
        // about to send so the bar tracks actual ffmpeg runtime: roughly
        // 9 s of real time per segment for xfade encoding.
        try {
          const _segCount = Array.isArray(_composeBase.segments)
            ? _composeBase.segments.length
            : (_composeBase.video_url ? 1 : 0);
          if (_segCount > 0 && state.progress && state.progress.compose) {
            const _newEta = Math.max(60, _segCount * 9);
            state.progress.compose.etaSecs = _newEta;
            console.info(
              "%c[mv-pipeline][compose-eta] dynamic etaSecs=%ds for %d segments",
              "color:#08a", _newEta, _segCount
            );
          }
        } catch (_etaErr) { /* non-fatal */ }
        composed = await withTimeout(
          postJson(
            "/api/mv/compose",
            withEngine("compose", _composeBase)
          ),
          COMPOSE_TIMEOUT_MS,
          "compose"
        );
      } catch (composeErr) {
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
        const sentinel = new Error("__CSSMV_SHORT_CIRCUIT__:compose:" + composeMsg);
        sentinel.__shortCircuit = "compose";
        throw sentinel;
      }

      // CSSOS_MV_DAG_WAVE_7F 20260508 — state.mvUrl + recordEngine + setStage
      // are now sequenced by the DAG callback via applyStageOutput. The
      // helper still does syncWatchOutputs() + renderSummary() because they
      // read state.mvUrl which the caller has just written via apply.
      // Pre-write state.mvUrl here so the DOM-side autoplay/hot-swap below
      // (still inline) sees it. The DAG callback re-writes it idempotently.
      state.mvUrl = composed.public_url;
      // P2-31: final sync so anything that appeared late (e.g. mvUrl) is reflected.
      syncWatchOutputs();
      renderSummary();
      // CSSOS_PHASE2_HOT_SWAP 20260504 — Jing
      // "MV PIPELINE 走流程的时候，正在播放的媒体是否可以不用暂停？
      //  等新的媒体输出完毕，直接替换正在播放的媒体，全新播放."
      // Tag the watch <audio> + <video> as "safe stream" — the next
      // pipeline run's KILL_STALE_HARD block will see this marker and
      // skip the kill, letting playback continue uninterrupted until
      // THIS run's compose-done lands new URLs (which the syncWatch
      // pipeline above hot-swaps in atomically — browser stops the
      // old src + starts the new in microseconds, no perceptible gap).
      try {
        const audioElTag = document.getElementById("watch-audio-preview");
        const videoElTag = document.getElementById("watch-video");
        if (audioElTag && audioElTag.dataset) audioElTag.dataset.cssmvSafeStream = "1";
        if (videoElTag && videoElTag.dataset) videoElTag.dataset.cssmvSafeStream = "1";
      } catch (_e) { /* non-fatal */ }

      // CSSOS_PHASE2_PIPELINE_RESULT_LOCK 20260426 #137 — Jing
      // "Watch 面板再次跑整个流程而不播放已有 mvUrl"
      //
      // Publish the MV Pipeline run's authoritative result globally so any
      // Watch-panel entry point (logo, mic, play, right-click, advanced
      // settings, openWatchPreviewFlow) can adopt it and SKIP its own legacy
      // creative-engine kickoff. Watch-ui guards on
      // `cssmvPipelineLastResult.tsAt` being within `freshMs` (default 10
      // minutes) before deciding to play vs. spawn a new run.
      try {
        globalThis.cssmvPipelineLastResult = {
          mvUrl: state.mvUrl,
          audioUrl: state.audioUrl,
          coverUrl: state.coverUrl,
          subtitlesSrt: state.subtitlesSrt,
          title: state.title,
          duration: state.duration,
          mvId: composed.mv_id || "",
          runId: state.runId || "",
          tsAt: Date.now(),
          freshMs: 10 * 60 * 1000,
          source: "mv-pipeline-panel"
        };
        // CSSOS_MV_DAG_WAVE_7F 20260508 — cssos:kara_ready dispatch lifted
        // into dispatchStageEvents("compose"). Notification-panel hydration
        // payload is now fired from the DAG callback.
        // CSSOS_PHASE2_AUDIO_OVERRIDE 20260426 #139 — Jing
        // "音乐引擎还是fallback到之前旧的音乐"
        // Force-push the freshly-generated audio URL into <audio> so the
        // remembered-final-audio path can't steal back the old mp3 when
        // Watch panel opens. Must run AFTER the lock so any race-condition
        // adopt code reads the new URL too.
        if (state.audioUrl) {
          const audioEl = document.getElementById("watch-audio-preview");
          if (audioEl && audioEl.src !== state.audioUrl) {
            audioEl.src = state.audioUrl;
            audioEl.preload = "auto";
            if (typeof audioEl.load === "function") audioEl.load();
            // CSSOS_PHASE2_AUDIO_DURATION_BACKFILL 20260429 #168.8b — Jing
            // ElevenLabs sync-binary path returns duration_secs=null. We
            // also need to re-seed karaoke timeline with the REAL audio
            // duration once the browser parses the file headers.
            const onMeta = function () {
              try {
                const realDur = Number(audioEl.duration);
                if (Number.isFinite(realDur) && realDur > 0 && Math.abs(realDur - state.duration) > 1) {
                  console.info(
                    "%c[mv-pipeline][audio-duration] backfilled state.duration %ds → %ds from <audio>.duration",
                    "color:#0a8;font-weight:bold", state.duration, Math.round(realDur)
                  );
                  state.duration = realDur;
                  // Re-seed karaoke timeline with the real number.
                  try {
                    const cache = globalThis.watchKaraokeTimelineCache;
                    if (cache && state.lyrics && (!state.alignedLyrics || state.alignedLyrics.length === 0)) {
                      const lines = String(state.lyrics)
                        .split("\n")
                        .map((s) => s.trim())
                        .filter((s) => s && !/^\[.*\]$/.test(s) && !/^\(.*\)$/.test(s));
                      if (lines.length > 0) {
                        const step = realDur / lines.length;
                        cache.data = lines.map((text, i) => ({
                          start_s: Number((i * step).toFixed(3)),
                          end_s: Number(((i + 1) * step).toFixed(3)),
                          text,
                        }));
                        cache.runId = state.runId || state.taskId || `mv-${state.startedAt || Date.now()}`;
                        cache.error = "";
                        cache.pending = false;
                        try { globalThis.renderWatchKaraokeOverlayModule?.(); } catch (_e) {}
                        console.info(
                          "%c[mv-pipeline][karaoke-reseed] re-seeded %d cues to span %.1fs",
                          "color:#0a8;font-weight:bold", lines.length, realDur
                        );
                      }
                    }
                  } catch (_e) { /* non-fatal */ }
                }
              } catch (_e) { /* non-fatal */ }
              audioEl.removeEventListener("loadedmetadata", onMeta);
            };
            audioEl.addEventListener("loadedmetadata", onMeta);
          }
          // CSSOS_PHASE2_3STREAM_PARALLEL_PLAY 20260427 #159 — Jing
          // "看不到视频了，好像只有图片在幻灯，没有了声音。"
          // After #151 separated streams, state.mvUrl is video-only (no
          // audio track inside) and state.audioUrl is the music engine
          // URL. The Watch <video> playing alone is silent. We must:
          //   1. The <audio> element was already gesture-primed at runAll()
          //      entry, so unmuted .play() is granted here without any
          //      additional user click. (#159b zero-click hardening)
          //   2. Start audio.play() alongside video.play() — UNMUTED.
          //   3. Mirror video's play/pause/seek lifecycle into audio.
          if (audioEl) {
            audioEl.muted = false;
            audioEl.volume = 1;
            audioEl.playsInline = true;
            audioEl.play().catch(function (err) {
              // If unmuted autoplay was somehow denied (e.g. cross-origin
              // gesture loss), fall back to muted-autoplay so playback
              // still starts. The first subsequent user input unmutes.
              console.warn(
                "[mv-pipeline][3stream] unmuted autoplay denied — falling back to muted:", err
              );
              audioEl.muted = true;
              audioEl.play().catch(function (err2) {
                console.warn("[mv-pipeline][3stream] muted autoplay also blocked:", err2);
              });
            });
          }
          // Wire video<->audio sync (idempotent — install once per session)
          const videoElForSync = document.getElementById("watch-video");
          if (videoElForSync && audioEl && !globalThis.__cssmv3StreamSyncInstalled) {
            const syncAudioToVideo = function () {
              try {
                const drift = Math.abs((audioEl.currentTime || 0) - (videoElForSync.currentTime || 0));
                if (drift > 0.30) {
                  audioEl.currentTime = videoElForSync.currentTime || 0;
                }
              } catch (_e) { /* non-fatal */ }
            };
            videoElForSync.addEventListener("play", function () {
              audioEl.play().catch(function () {});
            });
            videoElForSync.addEventListener("pause", function () {
              try { audioEl.pause(); } catch (_e) {}
            });
            videoElForSync.addEventListener("seeked", syncAudioToVideo);
            videoElForSync.addEventListener("ratechange", function () {
              try { audioEl.playbackRate = videoElForSync.playbackRate || 1; } catch (_e) {}
            });
            // Drift-correct every 2s during normal playback.
            setInterval(function () {
              if (!videoElForSync.paused && !audioEl.paused) syncAudioToVideo();
            }, 2000);
            globalThis.__cssmv3StreamSyncInstalled = true;
            console.info(
              "%c[mv-pipeline][3stream] video<->audio sync installed",
              "color:#08f;font-weight:bold"
            );
          }
        }
      } catch (_e) { /* non-fatal */ }

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

        // CSSOS_PHASE2_ZERO_TOUCH 20260426 #149 — Jing
        // "My pipeline 面板完成所有环节100%之后，应该自动最大化窗口开启 Watch
        //  面板，并且自动播放媒体，不要让用户再有任何的操作。这才是零门槛
        //  用户体验。"
        //
        // Previously we set the <video> src and called attemptPlayback, but
        // never explicitly opened or maximized the Watch panel. If it was
        // hidden (default state on first run after login) the user had to
        // click the dock icon to even see the result. That's not zero-touch.
        //
        // Sequence (zero-touch):
        //   1) Find the Watch panel; create-from-template if not yet mounted.
        //   2) openWatchPreviewShellModule({fallbackTab:"mv"}) — makes panel
        //      visible, primes layout, activates MV tab.
        //   3) Maximize via openAndMaximize / togglePanelMaximize so the
        //      media frame fills the viewport. Watch panel is hardcoded to
        //      fullscreen mode (panel-layout.js:144) so this is full-bleed.
        //   4) THEN setWatchVideoFromArtifact + attemptPlayback.
        //
        // Each step is wrapped in a try so a missing helper degrades to the
        // pre-#149 behavior (silent inner panel, but at least the autoplay
        // attempt still fires).
        try {
          const watchPanel = document.getElementById("watch-panel");
          if (watchPanel) {
            // Open the panel shell first — this also activates the preferred
            // tab and primes the layout via app.watch-ui.js helpers.
            if (typeof globalThis.openWatchPreviewShellModule === "function") {
              globalThis.openWatchPreviewShellModule({ fallbackTab: "mv" });
            } else {
              // Fallback: just remove .hidden and focus
              watchPanel.classList.remove("hidden");
              watchPanel.dataset.minimized = "false";
              if (typeof globalThis.focusPanel === "function") {
                globalThis.focusPanel(watchPanel);
              }
            }
            // Maximize unless the user already moved/maximized it. Watch
            // panel is fullscreen mode — covers the whole viewport.
            const alreadyMax = watchPanel.dataset.maximized === "true";
            if (!alreadyMax) {
              if (typeof globalThis.openAndMaximize === "function") {
                globalThis.openAndMaximize(watchPanel);
              } else if (typeof globalThis.togglePanelMaximize === "function") {
                globalThis.togglePanelMaximize(watchPanel);
              }
            }
            console.info(
              "%c[mv-pipeline][zero-touch] Watch panel opened + maximized (was-max=%s)",
              "color:#0c0;font-weight:bold",
              alreadyMax ? "yes" : "no"
            );

            // CSSOS_PHASE2_TRUE_FULLSCREEN 20260427 #157 — Jing
            // "Watch面板请全屏播放，就像用户手动点了媒体框右下角的全屏按钮
            //  一样。"
            //
            // togglePanelMaximize fills the viewport WITHIN the browser
            // tab (Safari menu bar + tab strip + dock all still visible).
            // requestFullscreen() escapes the browser chrome entirely — that's
            // the "media frame fullscreen button" experience Jing asks for.
            //
            // Fullscreen API requires a user gesture for the request to
            // succeed. The pipeline run was started by a user click, but
            // by the time compose finishes (3-8 minutes later) the gesture
            // has expired and Safari/Chrome will reject the request.
            //
            // Strategy: try it anyway, swallow the rejection silently, and
            // fall through to a one-time click handler that requests
            // fullscreen on the next user interaction. Net effect: if the
            // gesture is still hot, fullscreen fires immediately; if not,
            // the very next click in the panel triggers it.
            // CSSOS_PHASE2_TRUE_FULLSCREEN 20260430 #204b — Jing
            // "现在是输出完毕进入全屏自动播放...这还不是真正的全屏，
            //  证据：用户点击媒体框右下角的全屏按钮，还可以继续全屏."
            //
            // The previous attempt only armed the next-click listener AFTER
            // the requestFullscreen rejection — but in practice the rejection
            // was an async promise, and any clicks that fired between
            // rejection and listener installation were lost. Now we install
            // the listener IMMEDIATELY, then race the direct request. If
            // the direct request succeeds, the listener disarms itself.
            //
            // Target priority: .watch-frame (fills viewport, no chrome) >
            // <video> (Safari iOS fallback). The whole watchPanel is a
            // poor target because it includes the title bar + subtitle
            // bar which pad the actual media frame.
            try {
              const requestFs = (el) => {
                if (!el) return Promise.resolve(false);
                const fn =
                  el.requestFullscreen ||
                  el.webkitRequestFullscreen ||
                  el.msRequestFullscreen ||
                  null;
                if (!fn) {
                  // iOS Safari only exposes fullscreen on the <video>
                  // element via webkitEnterFullscreen.
                  if (el.webkitEnterFullscreen) {
                    try { el.webkitEnterFullscreen(); return Promise.resolve(true); }
                    catch (_e) { return Promise.resolve(false); }
                  }
                  return Promise.resolve(false);
                }
                try {
                  const result = fn.call(el);
                  if (result && typeof result.then === "function") {
                    return result.then(() => true).catch((err) => {
                      console.warn("[mv-pipeline][zero-touch] requestFullscreen rejected:", err?.name || err);
                      return false;
                    });
                  }
                  return Promise.resolve(true);
                } catch (e) {
                  console.warn("[mv-pipeline][zero-touch] requestFullscreen threw:", e);
                  return Promise.resolve(false);
                }
              };
              const watchFrame = document.querySelector("#watch-panel .watch-frame");
              const watchVideoEl = document.getElementById("watch-video");
              const fsTargets = [watchFrame, watchVideoEl, watchPanel].filter(Boolean);
              const tryFsChain = async () => {
                for (const t of fsTargets) {
                  const ok = await requestFs(t);
                  if (ok) {
                    console.info(
                      "%c[mv-pipeline][zero-touch] entered TRUE fullscreen on %s",
                      "color:#0a0;font-weight:bold",
                      t.id || t.className || t.tagName
                    );
                    return true;
                  }
                }
                return false;
              };
              // Install the one-shot listener FIRST so any user click that
              // arrives during/after the rejection re-tries fullscreen.
              if (globalThis.__cssmvFsArmHandlerCleanup) {
                try { globalThis.__cssmvFsArmHandlerCleanup(); } catch (_e) {}
              }
              const fsOnInput = function () {
                if (document.fullscreenElement) {
                  cleanup();
                  return;
                }
                tryFsChain().then((ok) => {
                  if (ok) cleanup();
                });
              };
              const cleanup = () => {
                window.removeEventListener("click", fsOnInput, true);
                window.removeEventListener("keydown", fsOnInput, true);
                window.removeEventListener("touchstart", fsOnInput, true);
                globalThis.__cssmvFsArmHandlerCleanup = null;
              };
              window.addEventListener("click", fsOnInput, true);
              window.addEventListener("keydown", fsOnInput, true);
              window.addEventListener("touchstart", fsOnInput, true);
              globalThis.__cssmvFsArmHandlerCleanup = cleanup;
              // Now race the direct attempt. If gesture is still hot, this
              // wins and disarms the listener; otherwise the next user
              // input will succeed.
              tryFsChain().then((ok) => {
                if (ok) cleanup();
                else console.info("[mv-pipeline][zero-touch] fullscreen armed for next user click");
              });
            } catch (_fsErr) { /* non-fatal — maximize still active */ }
          }
        } catch (_openMaxErr) {
          console.warn("[mv-pipeline][zero-touch] open+maximize failed:", _openMaxErr);
        }

        if (mvUrlPlayable && state.mvUrl && typeof globalThis.setWatchVideoFromArtifact === "function") {
          // Push MV URL into the Watch <video> element.
          globalThis.setWatchVideoFromArtifact(state.mvUrl, { sourceKind: "mv-pipeline-final" });
          // CSSOS_PHASE2_FORCE_WATCH_PLAY 20260428 #168 — Jing
          // "图1，只有1分钟，而且只在My pipeline面板这里可以播放有声音，
          //  MV面板没有自动播放. 我知道，mp3,mp4都输出了，就是不知道哪个
          //  地方的代码，没有接过来."
          //
          // setWatchVideoFromArtifact only sets src + load() — never
          // calls play(). After #166 cleared the loop attribute and reset
          // src at runAll start, the Watch <video> sits paused after the
          // src is reassigned. Explicitly play() it here, with the same
          // muted-then-unmute pattern the dock unmute handler uses.
          try {
            const watchV = document.getElementById("watch-video");
            if (watchV) {
              watchV.muted = true;
              watchV.playsInline = true;
              const _kick = () => {
                const p = watchV.play();
                if (p && typeof p.then === "function") {
                  p.catch((err) => {
                    console.warn("[mv-pipeline][force-play] muted play() rejected:", err);
                  });
                }
              };
              if (watchV.readyState >= 2) {
                _kick();
              } else {
                watchV.addEventListener("canplay", _kick, { once: true });
                _kick(); // also try right now in case the metadata is already there
              }
              console.info(
                "%c[mv-pipeline][force-play] kicked Watch <video> with mvUrl",
                "color:#0a8;font-weight:bold"
              );
            }
          } catch (_kickErr) {
            console.warn("[mv-pipeline][force-play] failed:", _kickErr);
          }
        }
        // Switch to MV tab so the user lands on the composed MV — but only
        // if the file is actually playable. Otherwise stay on Music.
        if (mvUrlPlayable && typeof globalThis.activateWatchTab === "function") {
          globalThis.activateWatchTab("mv");
        }
        if (!mvUrlPlayable) {
          // CSSOS_PHASE2_FALLBACK_TIERS 20260427 #157 — Jing
          // "如果MV的视频媒体要fallback的话，请fallback到Music标签页播放
          //  音乐，或者在MV标签页播放封面图幻灯。"
          //
          // Tiered fallback ladder when the composed MV mp4 is not
          // playable (HEAD probe 404, network error, etc.):
          //   Tier 1 — Real MV (handled in the else branch below).
          //   Tier 2 — Cover Ken Burns slideshow on the MV tab.
          //            User still sees video-shaped media + hears music
          //            via separate <audio>. Cover image is real cover,
          //            not the "假视频" abstract shapes.
          //   Tier 3 — Pure music tab (audio + circular vinyl progress).
          //            Used when even the cover is missing.
          //
          // Tier 2 is preferred because it keeps the MV-shaped panel
          // experience. Tier 3 is the absolute floor — never silent.
          let _fallbackHandled = false;
          if (state.coverUrl &&
              typeof globalThis.activateWatchTab === "function" &&
              typeof globalThis.startWatchCoverSlideshowModule === "function") {
            try {
              globalThis.activateWatchTab("mv");
              globalThis.startWatchCoverSlideshowModule({
                coverUrl: state.coverUrl,
                durationSecs: state.duration || 60,
                kenBurns: true
              });
              if (typeof globalThis.showToast === "function") {
                globalThis.showToast(copy(
                  "Video unavailable · cover slideshow with music",
                  "视频不可用 · 已切换到封面幻灯 + 音乐"
                ));
              }
              console.info(
                "%c[mv-pipeline][fallback] tier 2 — cover slideshow on MV tab",
                "color:#f80;font-weight:bold"
              );
              _fallbackHandled = true;
            } catch (_slideErr) {
              console.warn("[mv-pipeline][fallback] cover slideshow failed:", _slideErr);
            }
          }
          if (!_fallbackHandled &&
              typeof globalThis.fallbackWatchPlaybackToMusicModule === "function") {
            globalThis.fallbackWatchPlaybackToMusicModule(copy(
              "Composed video not available · playing music",
              "合成视频不可用 · 已切换到音乐播放"
            ));
            console.info(
              "%c[mv-pipeline][fallback] tier 3 — Music tab (no cover available)",
              "color:#f80;font-weight:bold"
            );
          }
        } else if (typeof globalThis.attemptWatchVideoPlaybackModule === "function") {
          // CSSOS_PHASE2_NO_FAKE_FALLBACK 20260427 #154 — Jing
          // "图1，有时候还fallback到这个视频，我们不是已经有真的视频了吗？
          //  请不要再 fallback 到这个假视频。"
          //
          // Previously the autoplay attempt was unmuted-first, retry-with-
          // music-fallback. The autoplay-block path inside
          // attemptWatchVideoPlaybackModule routes to fallbackWatchPlaybackToMusicModule
          // after maxRetries=3 × interval=800ms = 2.4s — which fires BEFORE
          // any of our muted-retry safety nets. End result: real MV exists
          // but Watch swaps to the Music tab + cover-slideshow ("fake video"
          // in Jing's words).
          //
          // New approach: PRE-MUTE the video element BEFORE the play()
          // attempt. Browsers always allow muted autoplay (no user gesture
          // required), so play() succeeds first try, no fallback ever fires,
          // and the real MV stays visible. The unmute-on-first-input
          // handler installed below restores audio the moment the user
          // clicks/keys/taps anywhere.
          //
          // This is the "muted-first, never fallback" principle —
          // contradicts the original "unmuted-first, fallback to music"
          // design but matches Jing's "the real MV must always show."
          const watchVideoEl = document.getElementById("watch-video");
          if (watchVideoEl) {
            // CSSOS_PHASE2_UNMUTED_AUTOPLAY 20260429 #174 — Jing
            // "Watch MV面板还没有接过来自动播放" — pre-mute was preventing
            // unmuted autoplay even when AudioContext was successfully
            // resumed under user gesture. Only pre-mute if the gesture
            // grant didn't actually take effect (defensive fallback).
            // When AudioContext.state === "running", the browser already
            // grants unmuted autoplay session-wide.
            let _audioCtxRunning = false;
            try {
              const ctx = globalThis.__cssmvAudioCtx ||
                globalThis.__cssmvSharedAudioContext ||
                null;
              _audioCtxRunning = !!(ctx && ctx.state === "running");
            } catch (_e) { /* ignore */ }
            if (_audioCtxRunning) {
              // Try unmuted autoplay first (gesture grant should allow it).
              watchVideoEl.muted = false;
              watchVideoEl.volume = 1;
              console.info(
                "%c[mv-pipeline][zero-touch] AudioContext running — attempting UNMUTED autoplay (no pre-mute)",
                "color:#0a8;font-weight:bold"
              );
            } else {
              // No gesture grant detected — pre-mute as fallback so video
              // still plays muted; first user input unmutes (legacy path).
              watchVideoEl.muted = true;
              console.info(
                "%c[mv-pipeline][zero-touch] pre-muted video for guaranteed autoplay; first user input will unmute",
                "color:#08f;font-weight:bold"
              );
            }
          }
          // Set up one-time unmute-on-first-input handler BEFORE we try
          // playback. If autoplay succeeds unmuted, this is harmless.
          if (watchVideoEl && !globalThis.__cssmvUnmuteHandlerInstalled) {
            const unmuteOnFirstInput = function () {
              // CSSOS_PHASE2_VIDEO_HAS_AUDIO 20260428 #168 — Jing reverted
              // #151. After #164 the final_mv.mp4 has audio MUXED in via
              // ffmpeg `-c:a aac -map 1:a:0 -shortest`, so unmuting the
              // VIDEO element is what gives sound. The <audio> element
              // is paused/empty after #166 stale-kill — don't touch it.
              try {
                if (watchVideoEl.muted) {
                  watchVideoEl.muted = false;
                  watchVideoEl.volume = 1;
                  if (watchVideoEl.paused) {
                    watchVideoEl.play().catch(function () {});
                  }
                  console.info("[mv-pipeline][unmute] user input → unmuted video (audio muxed in mp4 post-#164)");
                }
              } catch (_e) { /* non-fatal */ }
              window.removeEventListener("click", unmuteOnFirstInput, true);
              window.removeEventListener("keydown", unmuteOnFirstInput, true);
              window.removeEventListener("touchstart", unmuteOnFirstInput, true);
              globalThis.__cssmvUnmuteHandlerInstalled = false;
            };
            window.addEventListener("click", unmuteOnFirstInput, true);
            window.addEventListener("keydown", unmuteOnFirstInput, true);
            window.addEventListener("touchstart", unmuteOnFirstInput, true);
            globalThis.__cssmvUnmuteHandlerInstalled = true;
          }
          // CSSOS_PHASE2_NO_FAKE_FALLBACK 20260427 #154 — pre-muted, so
          // we explicitly disable music-tab fallback. The video WILL
          // autoplay (browsers grant muted autoplay unconditionally);
          // no path that switches Watch to the cover-slideshow Music
          // tab is needed any more.
          globalThis.attemptWatchVideoPlaybackModule({
            maxRetries: 3,
            interval: 800,
            allowFallback: false
          });
          // Defense in depth: 2.5s after kicking the attempt, if the
          // <video> element still hasn't started playing AND it's not
          // muted, force muted=true and retry once. This catches the
          // "autoplay denied because no recent user-interaction signal"
          // case Chrome/Safari throw silently.
          if (watchVideoEl) {
            setTimeout(function () {
              try {
                if (watchVideoEl.paused && !watchVideoEl.ended && watchVideoEl.readyState >= 2) {
                  if (!watchVideoEl.muted) {
                    console.info(
                      "%c[mv-pipeline][zero-touch] still paused after 2.5s — forcing muted autoplay",
                      "color:#f80;font-weight:bold"
                    );
                    watchVideoEl.muted = true;
                    watchVideoEl.play().catch(function (e) {
                      console.warn("[mv-pipeline][zero-touch] muted autoplay also blocked:", e);
                    });
                  }
                }
              } catch (_mutedErr) { /* non-fatal */ }
            }, 2500);
          }
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

      // CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
      // "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复
      //  的作品。系统必须自动做这一步，不能让用户手动添加，而是自动添加。"
      //
      // Auto-fire saveAsWork() exactly once per finished mv_id. The state
      // guard inside saveAsWork() guarantees that even if compose-done re-runs
      // (resume, retry, double-runAll) we POST /api/mv/commit at most once.
      // Server still has source_run_id ON CONFLICT as defense in depth.
      try {
        const composedMvId = composed.mv_id || "";
        if (composedMvId) {
          // Fire-and-forget — do NOT await. This must not block the
          // autoplay handoff. Toast surfaces success/fail, console captures
          // the diagnostic line if anything goes wrong.
          saveAsWork(composedMvId).then(function (res) {
            if (res && res.work_id) {
              console.info(
                "%c[mv-pipeline][autosave] work_id=%s · total=%s · dedup=%s",
                "color:#0a0;font-weight:bold",
                res.work_id,
                formatUsd(res.total_engine_cost_cents),
                res.dedup === true ? "yes" : "no"
              );
              // CSSOS_PHASE2_RUN_FINISH 20260507 — Wave 2.6 polish — Jing
              // Single canonical event so cinema mode (and any future
              // listener) can react to a finished pipeline run.
              try {
                globalThis.dispatchEvent(new CustomEvent("cssmv:run-finish", {
                  detail: { work_id: res.work_id, mv_id: composedMvId }
                }));
              } catch (_dispatchErr) {}
            }
          });
        } else {
          console.warn(
            "[mv-pipeline][autosave] skipped — composed.mv_id missing (server should always emit one)"
          );
        }
      } catch (_autosaveErr) {
        console.error("[mv-pipeline][autosave] threw synchronously:", _autosaveErr);
      }
      } // end Stage 6 (compose) primary block
      return {
        composed: composed,
        public_url: composed ? composed.public_url : null,
        mv_id: composed ? composed.mv_id : null,
        cost_cents: composed ? (composed.cost_cents || 0) : 0,
        _resp: composed
      };
      } // end runComposeStage

      // CSSOS_MV_DAG_WAVE_2_7C 20260507 — Jing
      // Single-source-of-truth pipeline: every stage runs via the DAG
      // executor with explicit dependencies. Cover + lyrics fan out as
      // root nodes (no deps); music gates on lyrics; video gates on
      // cover/music/lyrics; subs gates on lyrics/music; compose gates
      // on cover/music/video/subs. The DAG runs whatever can run in
      // parallel and serialises whatever has a true data dependency.
      //
      // Helpers own their own setStage / recordEngine / state mutations
      // (matching the legacy imperative behavior byte-for-byte). Stage
      // callbacks here are minimal — only the cover task wraps its
      // helper to apply the legacy post-processing the cover IIFE used
      // to do (state.coverUrl, recordEngine, setStage("done", …)).
      //
      // Video / compose helpers signal short-circuit failure by setting
      // their own error chips + firing fallbackToMusicOnly internally,
      // then we throw a sentinel so the DAG marks downstream stages as
      // skipped and we exit runPipeline cleanly.
      const _dagCoverCache = (state.coverUrl && (!state._resumeCompleted || state._resumeCompleted.indexOf("cover") >= 0))
        ? { cover: { image_url: state.coverUrl, cost_cents: 0, cached: true } }
        : {};
      // CSSOS_MV_DAG_WAVE_7B 20260508 — NOTE: lyrics is not pre-populated
      // into the DAG cache even when state.lyrics already exists, because
      // the user-provided branch of runLyricsStage still needs to fire the
      // deriveSettingsForUserLyrics LLM call (title + sections + shot
      // scripts + Advanced-Settings derived envelope). Skipping the helper
      // would silently drop those derivations. Resume of a fully-completed
      // lyrics stage is already covered by STAGE_ORDER/resumeStartIdx.
      const _SHORT_CIRCUIT = "__CSSMV_SHORT_CIRCUIT__";
      const _pipelineDag = globalThis.cssmvDag.create()
        .stage("cover", [], { weight: 10 }, async () => {
          if (STAGE_ORDER.indexOf("cover") < resumeStartIdx) return null;
          setStage("cover", "running", "");
          // CSSOS_MV_DAG_WAVE_7A 20260508 — Jing
          // Pure helper + apply/dispatch skeleton. Order matches the legacy
          // imperative path byte-for-byte: state mutation → engine record →
          // UX dispatch → setStage("done"). Cached pre-population is handled
          // by the executor's onStageDone hook below (skips recordEngine and
          // skips dispatchStageEvents because meta.cached === true).
          const cover = await runCoverStage(state, {});
          applyStageOutput(state, "cover", cover);
          recordEngine("cover", cover);
          dispatchStageEvents(state, "cover", cover, { cached: false });
          setStage("cover", "done", cover.image_url, cover.cost_cents);
          return cover;
        })
        .stage("lyrics", [], { weight: 5 }, async () => {
          if (STAGE_ORDER.indexOf("lyrics") < resumeStartIdx) return null;
          setStage("lyrics", "running", "");
          // CSSOS_MV_DAG_WAVE_7B 20260508 — pure helper. Helper returns
          // an output envelope; we sequence applyStageOutput +
          // recordEngine + dispatchStageEvents + setStage("done") here so
          // the DAG owns side-effect ordering byte-for-byte with legacy.
          const out = await runLyricsStage(state, {});
          if (!out) return null;
          applyStageOutput(state, "lyrics", out);
          if (!out.userProvided && out._resp) {
            recordEngine("lyrics", out._resp);
          }
          dispatchStageEvents(state, "lyrics", out, { cached: false });
          const _summary = String(state.lyrics || "");
          setStage(
            "lyrics",
            "done",
            _summary.slice(0, 120) + (_summary.length > 120 ? "…" : ""),
            out.cost_cents || 0
          );
          return state.lyrics || null;
        })
        .stage("music", ["lyrics"], { weight: 35 }, async () => {
          if (STAGE_ORDER.indexOf("music") < resumeStartIdx) return null;
          setStage("music", "running", "");
          // CSSOS_MV_DAG_WAVE_7C 20260508 — pure helper. Helper returns
          // an output envelope; we sequence applyStageOutput +
          // recordEngine + dispatchStageEvents + setStage("done") here so
          // the DAG owns side-effect ordering byte-for-byte with legacy.
          const out = await runMusicStage(state, {});
          if (!out) return null;
          applyStageOutput(state, "music", out);
          if (out._resp) recordEngine("music", out._resp);
          dispatchStageEvents(state, "music", out, { cached: false });
          // CSSOS_PHASE2_DUAL_TRACK_DURATION 20260430 #230 — done-label
          // computed here (lifted from helper). Format ♪1 m:ss · ♪2 m:ss.
          const _fmtDur = (secs) => {
            const n = Math.round(Number(secs) || 0);
            const m = Math.floor(n / 60);
            const s = n % 60;
            return `${m}:${String(s).padStart(2, "0")}`;
          };
          const _d1 = state.duration ? _fmtDur(state.duration) : null;
          const _d2 = state.altDuration ? _fmtDur(state.altDuration) : null;
          let _durationLabel = "";
          if (_d1 && _d2) _durationLabel = ` · ♪1 ${_d1} · ♪2 ${_d2}`;
          else if (_d1) _durationLabel = ` · ${_d1}`;
          const _musicCardTitle =
            String(state.title || (out._resp && out._resp.title) || "").trim() || "Track";
          setStage(
            "music",
            "done",
            _musicCardTitle + _durationLabel,
            out._resp ? out._resp.cost_cents : 0
          );
          return state.audioUrl || null;
        })
        .stage("video", ["cover", "music", "lyrics"], { weight: 35 }, async () => {
          // CSSOS_MV_DAG_WAVE_7D 20260508 — pure helper. Helper returns an
          // output envelope (or throws sentinel on hard fail). DAG owns
          // setStage / recordEngine ordering byte-for-byte with legacy.
          const out = await runVideoStage(state);
          if (!out) return null;
          applyStageOutput(state, "video", out);
          if (out.video_skipped) {
            setStage(
              "video",
              "done",
              copy(
                "Skipped (Lite tier · slideshow only)",
                "已跳过（Lite 档 · 仅幻灯片）"
              ),
              0
            );
          } else {
            if (out._resp) recordEngine("video", out._resp);
            dispatchStageEvents(state, "video", out, { cached: false });
            setStage("video", "done", out.video_url, out.cost_cents);
          }
          return out;
        })
        .stage("subs", ["lyrics", "music"], { weight: 5 }, async () => {
          if (STAGE_ORDER.indexOf("subtitles") < resumeStartIdx) return null;
          setStage("subtitles", "running", "");
          // CSSOS_MV_DAG_WAVE_7E 20260508 — pure helper. Helper returns an
          // output envelope; we sequence applyStageOutput + recordEngine +
          // dispatchStageEvents + setStage("done") here so the DAG owns
          // side-effect ordering byte-for-byte with legacy.
          const out = await runSubsStage(state);
          if (!out) return null;
          applyStageOutput(state, "subs", out);
          if (out.skipped) {
            setStage(
              "subtitles",
              "done",
              copy(
                "Subtitles skipped (" + out.skipReason + ")",
                "字幕已跳过（" + out.skipReason + "）"
              ),
              0
            );
          } else {
            if (out._resp) recordEngine("subtitles", out._resp);
            dispatchStageEvents(state, "subs", out, { cached: false });
            setStage(
              "subtitles",
              "done",
              copy(
                String(out.lineCount) + " lines · " + out.engine + "/" + out.version,
                out.lineCount + " 行 · " + out.engine + "/" + out.version
              ),
              out.cost_cents
            );
          }
          return state.subtitlesSrt || null;
        })
        .stage("compose", ["cover", "music", "video", "subs"], { weight: 10 }, async () => {
          // CSSOS_MV_DAG_WAVE_7F 20260508 — pure helper. Helper returns an
          // output envelope (or throws sentinel on hard fail). DAG owns
          // setStage / recordEngine + kara_ready dispatch byte-for-byte.
          const out = await runComposeStage(state);
          if (!out) return null;
          applyStageOutput(state, "compose", out);
          if (out._resp) recordEngine("compose", out._resp);
          dispatchStageEvents(state, "compose", out, { cached: false });
          if (out.public_url) {
            setStage("compose", "done", out.public_url, out.cost_cents);
          }
          return out.composed || null;
        });
      const _dagResult = await globalThis.cssmvDag.run(_pipelineDag, {
        ctx: { state: state },
        cache: _dagCoverCache,
        retry: { compose: 2, video: 1, music: 1 },
        onStageStart: function (_id) { /* helpers own setStage */ },
        onStageDone: function (_id, _output, _meta) { /* helpers own setStage */ },
        onStageError: function (id, err) {
          if (err && err.__shortCircuit) return; // helper already painted UI
          failStageProgress(id, err && err.message ? err.message : String(err));
        }
      });
      if (_dagResult.failed) {
        // Video / compose short-circuits: helpers already fired the UI
        // cleanup (error chips, fallbackToMusicOnly, renderSummary). Just
        // exit runPipeline; the `finally` block clears state.running.
        const _videoFail = _dagResult.failed.video;
        const _composeFail = _dagResult.failed.compose;
        if (_videoFail && _videoFail.__shortCircuit) return;
        if (_composeFail && _composeFail.__shortCircuit) return;
        // Real (non-short-circuit) failure on any stage — rethrow the
        // first one so the outer catch tags failingStage via
        // findRunningStage(), matching legacy behavior.
        const _firstErr = _videoFail || _composeFail
          || _dagResult.failed.cover || _dagResult.failed.lyrics
          || _dagResult.failed.music || _dagResult.failed.subs;
        if (_firstErr) throw _firstErr;
      }
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
      try { showMvOverallProgress(false); } catch (_e) {}
    }
  }

  // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
  // Single global entry point for all "万能入口" (universal entrances).
  // Logo long-press, mic button, play button, right-click 一键MV, Advanced
  // Settings Apply Render, etc. should all migrate to call:
  //   await globalThis.cssmvMvPipelineRunAll(opts);
  // The legacy creative-engine pipelines bypass MV-tier billing, skip the
  // segment planner, and fall back to old media — all bugs that the user
  // hit. Anchoring everything on this one entry collapses the divergence.
  if (globalThis) {
    globalThis.cssmvMvPipelineRunAll = runAll;

    // CSSOS_PHASE2_UNIFIED_ENTRY_HELPER 20260426 #138 — Jing
    // Convenience wrapper: opens the MV Pipeline panel (if not already
    // open), kicks runAll, and prints a labeled diagnostic so DevTools
    // shows the exact entry source: [entry:logo-longpress], [entry:mic],
    // [entry:dock-watch], [entry:context-menu-mv], [entry:apply-render].
    //
    // BEFORE calling runAll, also short-circuit on a fresh
    // cssmvPipelineLastResult so a second tap on the same entry doesn't
    // re-run the pipeline (already covered by Watch panel guard #137; this
    // mirrors the protection for entries that bypass openWatchPreviewFlow).
    globalThis.cssmvUnifiedEntry = function unifiedEntry(opts) {
      const o = opts && typeof opts === "object" ? opts : {};
      const source = String(o.source || "unknown");
      try {
        const lastRes = globalThis.cssmvPipelineLastResult;
        if (!o.force && lastRes && lastRes.mvUrl) {
          const tsAt = Number(lastRes.tsAt || 0);
          const freshMs = Number(lastRes.freshMs || 600000);
          if (tsAt && (Date.now() - tsAt) < freshMs) {
            console.info(
              "%c[entry:" + source + "] adopting fresh MV Pipeline result " +
              "(age %dms) — skipping new run",
              "color:#08f", Date.now() - tsAt
            );
            // Just open Watch — its #137 guard will adopt the result.
            if (typeof globalThis.openWatchPreviewFlowModule === "function") {
              return globalThis.openWatchPreviewFlowModule({
                preferredTab: o.preferredTab || "mv"
              });
            }
            return Promise.resolve(true);
          }
        }
      } catch (_e) { /* fall through */ }
      console.info(
        "%c[entry:" + source + "] → MV Pipeline runAll",
        "color:#0c0;font-weight:bold"
      );
      // CSSOS_PHASE2_WATCH_DIRECT 20260429 #169 — Jing
      // "应用并渲染按钮，输入各项参数之后，点击应该显示Watch MV面板输出
      //  MV给用户欣赏，可是现在点击没有动静".
      // Every universal entry (apply-render, dock-watch, mic, longpress, etc.)
      // must POP the Watch panel to front BEFORE kicking the pipeline so the
      // user sees progress + the eventual MV. The earlier code only opened
      // the MV Pipeline panel (often hidden) which left the user staring at
      // an unchanged screen.
      try {
        const watchPanel = globalThis.watchPanel || document.getElementById("watch-panel");
        if (watchPanel && typeof globalThis.openPanel === "function") {
          globalThis.openPanel(watchPanel);
        }
        const preferred = o.preferredTab || "mv";
        if (typeof globalThis.activateWatchTab === "function") {
          const resolveTab =
            globalThis.resolvePreferredWatchOpenTab || ((t) => t);
          globalThis.activateWatchTab(resolveTab(preferred) || preferred);
        }
        if (typeof globalThis.bringPanelToFrontBridge === "function" && watchPanel) {
          globalThis.bringPanelToFrontBridge(watchPanel, { repeatPasses: 3 });
        }
      } catch (_watchErr) { /* non-fatal — pipeline still kicks */ }
      // Open the MV Pipeline panel UI so user sees progress
      try {
        if (typeof globalThis.openMvPipelinePanel === "function") {
          globalThis.openMvPipelinePanel({
            autoStart: true,
            seed: o.seed || null,
            focus: o.focus === true,
            hidden: o.hidden !== false
          });
          return Promise.resolve(true);
        }
      } catch (_panelErr) { /* fall through */ }
      // Direct runAll if panel helper missing
      return runAll(o.runOpts || {});
    };
  }

  function findRunningStage() {
    for (const s of STAGES) {
      if (state.stageState[s.id] === "running") return s.id;
    }
    return null;
  }

  // CSSOS_PHASE2_AUTOSAVE 20260426 #147 — Jing
  // "Save as work不应该有这个按钮，我点了3次，作品中心/为你创作都有3个重复的
  //  作品。系统必须自动做这一步，不能让用户手动添加，而是自动添加。"
  //
  // Now invoked exactly once from the compose-done block with the freshly
  // assigned mv_id. Idempotency layers:
  //   1. State guard: if state.committedMvId === mvId, return immediately.
  //   2. We send `source_run_id: mvId` so the server-side handler can
  //      INSERT … ON CONFLICT (user_id, source_run_id) DO NOTHING and treat
  //      duplicate POSTs as a no-op (defense in depth — see pipeline_mv_api.rs
  //      commit_inner).
  //
  // Replaced alert() with showToast() so the success path doesn't yank
  // focus / block the autoplay handoff. Failure still surfaces via toast +
  // a console.error so we keep visibility without hijacking the run.
  async function saveAsWork(mvId) {
    if (!state.mvUrl) return null;
    const targetMvId = mvId || "";
    if (targetMvId && state.committedMvId === targetMvId) {
      console.info(
        "%c[mv-pipeline][autosave] skip — mvId %s already committed",
        "color:#888", targetMvId
      );
      return null;
    }
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
        // CSSOS_PHASE2_FULL_LYRICS_PERSIST 20260429 #169 — Jing
        // "MV Pipeline 总是截断歌词，只回灌一节歌词到为你创作面板和作品中心
        //  面板". The 200-char cap turned full multi-section Chinese lyrics
        //  into a 1-section preview that downstream Creation/Works Center
        //  rendered as the canonical lyric body. Send the full body so the
        //  saved work has all sections; backend will store what it can.
        lyrics_preview: state.lyrics ? state.lyrics.slice(0, 8000) : null,
        lyrics_full: state.lyrics || null,
        // CSSOS_PHASE2_PERSIST_DURATION 20260429 #170 — Jing
        // "请显示完整作品时长在为你创作面板/作品中心面板音乐卡片缩略图底部"
        // Persist the final MV duration so cards can render an overlay like
        // "3:42" pinned to the bottom-right of the cover thumbnail.
        duration_secs: Number(state.duration || 0) || null,
        cover_image_url: state.coverUrl,
        preview_image_url: state.coverUrl,
        // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — Jing
        // "都变成了无法欣赏，必须从头重新输出". Pass the FINAL composed mp4
        // as the preview_video_url so /api/works/mine returns a playable URL
        // when the user reopens the work — not the raw AI clip (state.videoUrl)
        // which is null on Lite tier and points at a pre-compose intermediate
        // on Pro+. The final MV plays cleanly everywhere.
        preview_video_url: state.mvUrl || state.videoUrl || null,
        final_mv_url: state.mvUrl,
        // CSSOS_PHASE2_PERSIST_PLAYABLE 20260430 #214 — persist the playback
        // payload so reopening a saved work doesn't trigger a re-run.
        audio_url: state.audioUrl || state.audioUrlBackendOnly || null,
        alt_audio_url: state.altAudioUrl || null,
        alt_duration_secs: Number(state.altDuration || 0) || null,
        subtitle_srt_url: state.subtitleSrtUrl || null,
        aligned_lyrics: state.alignedLyrics || null,
        // #147 — server-side dedup key. Same mv_id arriving twice should
        // resolve to the same work_id (no new row inserted).
        source_run_id: targetMvId || null,
        engine_costs_cents: engineCosts,
        // Extension point — see server-side /api/mv/commit handler. When the
        // route starts persisting this it will show up in the work detail UI
        // without a frontend change. Today it's additive metadata only.
        engine_meta: engineMeta
      });
      // Mark this mv_id committed so subsequent runs (e.g. resumed from
      // history, or compose-done firing twice) become no-ops.
      if (targetMvId) state.committedMvId = targetMvId;
      const savedMsg = copy(
        "Saved as work · ",
        "已保存为作品 · "
      );
      const totalLabel = formatUsd(resp.total_engine_cost_cents);
      const dedup = resp.dedup === true;
      const finalMsg = savedMsg + totalLabel + (dedup ? copy(" (deduplicated)", "（已去重）") : "");
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(finalMsg);
      } else {
        console.info("%c[mv-pipeline][autosave] " + finalMsg, "color:#0a0");
      }
      return resp;
    } catch (err) {
      const failMsg = copy("Auto-save failed: ", "自动保存失败：") + (err.message || String(err));
      console.error("[mv-pipeline][autosave]", err);
      if (typeof globalThis.showToast === "function") {
        globalThis.showToast(failMsg);
      }
      return null;
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
      // CSSOS_PHASE2_OPEN_MAXIMIZED 20260505 — Jing
      // "MV PIPELINE面板…请做成普通面板，最大化状态启动".
      // Same first-open-maximize as openMvPipelinePanel() above so
      // the dock-click path also lands fullscreen.
      try {
        if (panel.dataset.firstOpenMaximized !== "1" &&
            panel.dataset.userUnmaximized !== "1" &&
            panel.dataset.maximized !== "true" &&
            !panel.classList.contains("panel-collapsed") &&
            typeof globalThis.togglePanelMaximize === "function") {
          globalThis.togglePanelMaximize(panel);
          panel.dataset.firstOpenMaximized = "1";
        }
      } catch (_e) {}
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

  // CSSOS_PHASE2_MV_CINEMA 20260507 — Wave 2.5 Cinema mode
  // Maximize the pipeline panel, hide all chrome, render a black-bg
  // <video> that autoplays through `queue` (work_id list). Supports
  // ↑/↓ skip, ← exit, Space pause, M mute. Last 10s shows other MVs
  // for the same person as a teaser strip. Empty queue auto-triggers
  // a normal pipeline run and pushes the result into the queue.
  let cinemaSt = null;
  /* CSSOS_PERSON_MV_WAVE5_8 20260507 — module-scope cover cache + count fmt
   * shared by teaser posters + view-count toast. Keyed by work_id. */
  const __cinemaWorkCache = new Map();
  function __fmtCinemaCount(n){ var x=Number(n||0); if (x>=1e6) return (x/1e6).toFixed(1).replace(/\.0$/,'')+"M"; if (x>=1e3) return (x/1e3).toFixed(1).replace(/\.0$/,'')+"k"; return String(x); }
  async function __fetchWorkPublic(wid){
    if (!wid) return null;
    if (__cinemaWorkCache.has(wid)) return __cinemaWorkCache.get(wid);
    try {
      const r = await fetch("/api/works/public/" + encodeURIComponent(wid), { credentials: "include" });
      const j = await r.json().catch(function(){ return null; });
      const w = (j && (j.data || j.work || j)) || null;
      __cinemaWorkCache.set(wid, w);
      return w;
    } catch (_e) { return null; }
  }
  function enterCinemaMode(opts) {
    if (!isMvPipelineAllowedForCurrentUser()) {
      routeGuestToLogin();
      return null;
    }
    const panel = ensurePanel();
    // CSSOS_PERSON_MV_CINEMA_FIRST_BUG1 20260507 — Jing
    // Hide the MV PIPELINE panel ENTIRELY during cinema. Previous approach
    // tried to hide chrome via descendant CSS rules — but stale caches +
    // wrapper elements from togglePanelMaximize sometimes left chrome
    // visible. Cinema overlay now mounts at the BODY level (independent
    // of the panel) so the panel can be fully `display:none` and cinema
    // still renders.
    panel.dataset.cinema = "true";
    panel.classList.add("hidden");
    panel.style.display = "none";
    try { document.body.dataset.cinema = "true"; } catch (_e) {}
    ensureCinemaStyles();

    // Body-level cinema stage overlay (survives panel being hidden).
    let stage = document.getElementById("cssos-cinema-stage");
    if (!stage) {
      stage = document.createElement("div");
      stage.id = "cssos-cinema-stage";
      stage.className = "cinema-fullscreen cinema-stage";
      stage.innerHTML =
        '<video class="cinema-video" playsinline></video>' +
        '<div class="cinema-subs"><div class="cinema-subs-line" hidden></div></div>' +
        '<div class="cinema-strip"></div>' +
        '<div class="cinema-teaser" hidden></div>' +
        '<div class="cinema-loading" hidden></div>';
      document.body.appendChild(stage);
    }
    stage.style.display = "";

    cinemaSt = {
      panel: panel,
      stage: stage,
      queue: Array.isArray(opts.queue) ? opts.queue.filter(Boolean) : [],
      personId: opts.personId || null,
      idx: 0,
      teaserOn: false,
      keyHandler: null,
      seed: opts.seed || null,
      forceNew: !!opts.forceNew,
      person: {
        name: opts.personName || "",
        nameEn: opts.personNameEn || "",
        nameNative: opts.personNameNative || "",
        era: opts.personEra || "",
        civ: opts.personCiv || "",
        portrait: opts.personPortrait || "",
        intro: opts.personIntro || "",
      },
    };

    // Bind keys
    cinemaSt.keyHandler = function (e) {
      if (!document.body.dataset.cinema) return;
      if (e.key === "Escape" || e.key === "ArrowLeft") { exitCinemaMode(); e.preventDefault(); }
      else if (e.key === "ArrowDown") { cinemaSkip(+1); e.preventDefault(); }
      else if (e.key === "ArrowUp") { cinemaSkip(-1); e.preventDefault(); }
      else if (e.key === " ") { cinemaTogglePause(); e.preventDefault(); }
      else if (e.key === "m" || e.key === "M") { cinemaToggleMute(); e.preventDefault(); }
    };
    document.addEventListener("keydown", cinemaSt.keyHandler, true);

    if (cinemaSt.queue.length && !cinemaSt.forceNew) {
      cinemaPlayCurrent();
    } else {
      // Empty queue (or forceNew) → background pipeline run with hero loading.
      renderCinemaHeroLoading(stage, cinemaSt.person);
      // Pre-fill the (hidden) pipeline inputs from the seed so runAll picks
      // up the multiline prompt + style. Person seeds force-overwrite.
      try {
        const seed = cinemaSt.seed || {};
        const promptEl = panel.querySelector("#mvp-prompt");
        const styleEl = panel.querySelector("#mvp-style");
        const lyricsEl = panel.querySelector("#mvp-lyrics");
        const isPersonSeed = !!seed.__personId;
        if (promptEl && seed.prompt && (isPersonSeed || !promptEl.value)) {
          promptEl.value = String(seed.prompt);
          try { promptEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
        if (styleEl && seed.style && (isPersonSeed || !styleEl.value)) {
          styleEl.value = String(seed.style);
          try { styleEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
        }
        if (lyricsEl && isPersonSeed) lyricsEl.value = "";
      } catch (_e) {}
      // fire normal pipeline run in background
      try {
        if (typeof globalThis.cssmvRunPipeline === "function") {
          globalThis.cssmvRunPipeline({ seed: cinemaSt.seed });
        }
      } catch (_e) {}
      // Listen for runFinish event to push the new mv into queue
      const finishHandler = function (ev) {
        try {
          const wid = ev && ev.detail && (ev.detail.work_id || ev.detail.workId);
          if (wid && cinemaSt) {
            cinemaSt.queue.push(wid);
            const loading = stage.querySelector(".cinema-loading");
            if (loading) loading.hidden = true;
            cinemaPlayCurrent();
          }
        } catch (_e) {}
      };
      // CSSOS_PHASE2_RUN_FINISH 20260507 — Wave 2.6 polish — Jing
      // Canonical event name: `cssmv:run-finish`. Dispatched from the
      // autosave block (~line 5942) right after /api/mv/commit returns
      // a work_id. Only one listener — the legacy mvPipelineRunFinish
      // alias was never actually dispatched.
      globalThis.addEventListener("cssmv:run-finish", finishHandler, { once: true });
    }
    return panel;
  }
  function exitCinemaMode() {
    try { delete document.body.dataset.cinema; } catch (_e) {}
    if (!cinemaSt) return;
    const panel = cinemaSt.panel;
    if (panel) {
      delete panel.dataset.cinema;
      // Codex flow never wants the user dumped into the MV PIPELINE editor
      // after cinema exits. Keep the panel hidden so they fall back to
      // whatever was open underneath (typically the person codex page).
      panel.classList.add("hidden");
      panel.style.display = "none";
    }
    const stage = cinemaSt.stage || document.getElementById("cssos-cinema-stage");
    if (stage) {
      const v = stage.querySelector(".cinema-video");
      if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (_e) {} }
      stage.style.display = "none";
    }
    if (cinemaSt.keyHandler) {
      document.removeEventListener("keydown", cinemaSt.keyHandler, true);
    }
    // CSSOS_PERSON_MV_CINEMA_PROGRESS 20260507 — Jing
    // Tear down progress / error listeners attached by renderCinemaHeroLoading.
    if (typeof cinemaSt._cleanup === "function") {
      try { cinemaSt._cleanup(); } catch (_e) {}
    }
    // CSSOS_PHASE2_MV_WAVE6 20260507 — Jing
    // Tear down end-of-MV CTAs overlay + storm grid + bound key handlers.
    if (cinemaSt._w6KeyHandler) {
      try { document.removeEventListener("keydown", cinemaSt._w6KeyHandler, true); } catch (_e) {}
    }
    if (cinemaSt._w6Timer) { try { clearInterval(cinemaSt._w6Timer); } catch (_e) {} }
    if (cinemaSt._stormKeyHandler) {
      try { document.removeEventListener("keydown", cinemaSt._stormKeyHandler, true); } catch (_e) {}
    }
    if (cinemaSt._storm && cinemaSt._storm.runFinishHandler) {
      try { globalThis.removeEventListener("cssmv:run-finish", cinemaSt._storm.runFinishHandler); } catch (_e) {}
      cinemaSt._storm.cancelled = true;
    }
    cinemaSt = null;
  }
  async function cinemaPlayCurrent() {
    if (!cinemaSt || !cinemaSt.queue.length) return;
    const wid = cinemaSt.queue[cinemaSt.idx];
    if (!wid) return;
    const stage = cinemaSt.stage;
    const video = stage.querySelector(".cinema-video");
    const strip = stage.querySelector(".cinema-strip");
    let videoUrl = null, title = "", creator = "";
    try {
      // CSSOS_PHASE2_CINEMA_RESOLVER 20260507 — Wave 2.6 polish — Jing
      // /api/works/public/:id is the canonical public-readable work fetch.
      // Primary video field is `final_mv_url` (returned at the row top
      // level — see src/index.ts ~line 14323). Fallbacks kept for
      // ad-hoc shapes (e.g. cached/legacy responses or assets nesting).
      const r = await fetch("/api/works/public/" + encodeURIComponent(wid), { credentials: "include" });
      const j = await r.json().catch(function(){ return null; });
      const w = (j && (j.data || j.work || j)) || {};
      videoUrl = w.final_mv_url || w.preview_video_url || w.video_url || w.url ||
        (w.assets && (w.assets.video_url || w.assets.video || (w.assets.video && w.assets.video.url))) || null;
      title = w.title || w.name || "";
      creator = w.owner_name || w.creator || w.user_name || w.created_by || "";
      // CSSOS_PERSON_MV_CINEMA_SUBS 20260507 — Jing
      // Resolve emotion-aligned subtitles. Priority: aligned_lyrics
      // array (already parsed) > subtitle_srt_url (fetch + parse).
      cinemaSt._aligned = null;
      try {
        if (Array.isArray(w.aligned_lyrics) && w.aligned_lyrics.length) {
          cinemaSt._aligned = w.aligned_lyrics;
        } else if (w.subtitle_srt_url && typeof globalThis.parseSrtToAlignedLyricsModule === "function") {
          const sr = await fetch(w.subtitle_srt_url, { credentials: "include" });
          if (sr.ok) {
            const txt = await sr.text();
            cinemaSt._aligned = globalThis.parseSrtToAlignedLyricsModule(txt) || null;
          }
        }
      } catch (_e) {}
    } catch (_e) {}
    if (!videoUrl) {
      // skip to next
      if (cinemaSt.idx < cinemaSt.queue.length - 1) { cinemaSt.idx += 1; return cinemaPlayCurrent(); }
      return;
    }
    video.src = videoUrl;
    video.muted = false;
    video.autoplay = true;
    try { await video.play(); } catch (_e) {}
    if (strip) {
      // CSSOS_PERSON_MV_WAVE5 20260507 — strip now hosts title/idx + a Like button.
      const titleStr = (title || "untitled") + (creator ? " · " + creator : "") +
        " · " + (cinemaSt.idx + 1) + "/" + cinemaSt.queue.length;
      strip.innerHTML = '<span class="cinema-strip-title"></span>' +
        ' <button class="cinema-like-btn" type="button" title="Like" style="all:unset;cursor:pointer;margin-left:10px;padding:3px 10px;border-radius:999px;background:rgba(0,0,0,.55);border:1px solid rgba(0,245,160,.4);font:600 12px/1.2 ui-monospace,monospace;color:#daffee;">🤍 0</button>';
      const titleEl = strip.querySelector(".cinema-strip-title");
      if (titleEl) titleEl.textContent = titleStr;
      const likeBtn = strip.querySelector(".cinema-like-btn");
      cinemaSt._currentWid = wid;
      cinemaSt._likedByMe = false;
      // Initial stats fetch (also works for non-person_mvs entries — silently 404).
      try {
        const sR = await fetch("/api/person-mv/mvs/" + encodeURIComponent(wid) + "/stats", { credentials: "include" });
        if (sR.ok) {
          const sJ = await sR.json().catch(function(){ return null; });
          if (sJ && sJ.ok && likeBtn) {
            likeBtn.textContent = "🤍 " + __fmtCinemaCount(sJ.like_count);
          }
        }
      } catch (_e) {}
      if (likeBtn) {
        likeBtn.onclick = async function () {
          try {
            const lr = await fetch("/api/person-mv/mvs/" + encodeURIComponent(wid) + "/like",
              { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" });
            const lj = await lr.json().catch(function(){ return null; });
            if (lj && lj.ok) {
              cinemaSt._likedByMe = !!lj.liked;
              likeBtn.textContent = (lj.liked ? "❤️ " : "🤍 ") + __fmtCinemaCount(lj.like_count);
            }
          } catch (_e) {}
        };
      }
    }
    // CSSOS_PERSON_MV_WAVE5 20260507 — record a view as soon as the track plays.
    // Fires once per track-load (clearing old onplay). Toast surfaces position
    // + view_count when the row was newly-counted (not within the 5min dedup window).
    const __viewedKey = "_viewed_" + wid;
    if (!cinemaSt[__viewedKey]) {
      const onPlayOnce = async function () {
        if (!cinemaSt || cinemaSt[__viewedKey]) return;
        cinemaSt[__viewedKey] = true;
        try {
          const vr = await fetch("/api/person-mv/mvs/" + encodeURIComponent(wid) + "/view",
            { method: "POST", credentials: "include", headers: { "content-type": "application/json" }, body: "{}" });
          const vj = await vr.json().catch(function(){ return null; });
          if (vj && vj.ok && vj.was_new_view && vj.viewer_position) {
            try {
              const t = document.createElement("div");
              t.className = "cinema-view-toast";
              t.style.cssText = "position:absolute;top:18px;left:50%;transform:translateX(-50%);padding:8px 16px;border-radius:999px;background:rgba(0,0,0,.7);border:1px solid rgba(0,245,160,.45);color:#daffee;font:600 13px/1.2 ui-monospace,monospace;z-index:9999;backdrop-filter:blur(8px);";
              t.textContent = "👁 第 " + vj.viewer_position + " 位观众 · 已 " + __fmtCinemaCount(vj.view_count) + " 次播放";
              stage.appendChild(t);
              setTimeout(function(){ try { t.remove(); } catch (_e) {} }, 4000);
            } catch (_e) {}
          }
        } catch (_e) {}
      };
      video.addEventListener("play", onPlayOnce, { once: true });
    }
    // Teaser: last 10s
    cinemaSt.teaserOn = false;
    const subsLine = stage.querySelector(".cinema-subs-line");
    if (subsLine) { subsLine.hidden = true; subsLine.textContent = ""; subsLine.className = "cinema-subs-line"; }
    video.ontimeupdate = function () {
      if (!cinemaSt) return;
      const dur = video.duration || 0;
      if (dur > 0 && (dur - video.currentTime) <= 10 && !cinemaSt.teaserOn) {
        cinemaSt.teaserOn = true;
        showCinemaTeaser();
      }
      // CSSOS_PERSON_MV_CINEMA_SUBS 20260507 — emotion karaoke ticker.
      // Iterates aligned_lyrics rows {start_s,end_s,text,emotion?} and
      // surfaces the active line. Emotion class drives color tints in
      // CSS (matches watch-ui's `.is-{emotion}` convention).
      if (subsLine && cinemaSt._aligned) {
        const t = video.currentTime;
        let active = null;
        for (let i = 0; i < cinemaSt._aligned.length; i++) {
          const row = cinemaSt._aligned[i];
          const s = Number(row && (row.start_s || row.start || 0));
          const e = Number(row && (row.end_s || row.end || 0));
          if (t >= s && t <= e) { active = row; break; }
        }
        if (active) {
          const txt = String(active.text || "").trim();
          const emo = String(active.emotion || "").trim().toLowerCase();
          if (txt) {
            if (subsLine.textContent !== txt) subsLine.textContent = txt;
            subsLine.className = "cinema-subs-line" + (emo ? " is-" + emo : "");
            subsLine.hidden = false;
          } else {
            subsLine.hidden = true;
          }
        } else {
          subsLine.hidden = true;
        }
      }
    };
    video.onended = function () {
      const teaser = stage.querySelector(".cinema-teaser");
      if (teaser) teaser.hidden = true;
      // CSSOS_PHASE2_MV_WAVE6 20260507 — End-of-MV CTAs overlay (5s).
      try { showEndOfMvCtas(stage); } catch (_e) { cinemaSkip(+1); }
    };
  }
  function cinemaSkip(delta) {
    if (!cinemaSt) return;
    const next = cinemaSt.idx + delta;
    if (next < 0 || next >= cinemaSt.queue.length) {
      // wrap or exit at end — wrap so loop is endless
      cinemaSt.idx = (next + cinemaSt.queue.length) % cinemaSt.queue.length;
    } else {
      cinemaSt.idx = next;
    }
    cinemaPlayCurrent();
  }
  function cinemaTogglePause() {
    if (!cinemaSt) return;
    const v = cinemaSt.stage.querySelector(".cinema-video");
    if (!v) return;
    if (v.paused) { try { v.play(); } catch (_e) {} } else { v.pause(); }
  }
  function cinemaToggleMute() {
    if (!cinemaSt) return;
    const v = cinemaSt.stage.querySelector(".cinema-video");
    if (!v) return;
    v.muted = !v.muted;
  }
  async function showCinemaTeaser() {
    if (!cinemaSt || !cinemaSt.personId) return;
    const teaser = cinemaSt.stage.querySelector(".cinema-teaser");
    if (!teaser) return;
    try {
      const r = await fetch("/api/person-mv/persons/" + encodeURIComponent(cinemaSt.personId) + "/codex", { credentials: "include" });
      const j = await r.json().catch(function(){ return null; });
      const mvs = ((j && j.data && j.data.mvs) || []).filter(function(m){
        return m.work_id && m.work_id !== cinemaSt.queue[cinemaSt.idx];
      }).slice(0, 8);
      if (!mvs.length) return;
      // CSSOS_PERSON_MV_WAVE8 20260507 — teaser posters via /api/works/public.
      // Limit to 8 cards (already enforced by .slice(0,8) above) and pull
      // cover_image lazily through __cinemaWorkCache to avoid request storm.
      teaser.innerHTML = '<div class="cinema-teaser-label">同人物 · 其他版本</div>' +
        '<div class="cinema-teaser-row">' +
          mvs.map(function(m){
            const wid = String(m.work_id || "").replace(/"/g,"&quot;");
            const dur = (m.duration_secs || 0) + "s";
            return '<div class="cinema-teaser-card" data-work-id="' + wid + '" style="position:relative;overflow:hidden;background:linear-gradient(135deg,#012019,#003a2c);">' +
              '<span class="cinema-teaser-cap" style="position:relative;z-index:1;background:rgba(0,0,0,.55);padding:1px 5px;border-radius:3px;">' + dur + '</span>' +
            '</div>';
          }).join("") +
        '</div>';
      teaser.hidden = false;
      // Lazy-fetch cover_image per card; capped at 8 by the slice above.
      mvs.forEach(function (m) {
        if (!m.work_id) return;
        const card = teaser.querySelector('.cinema-teaser-card[data-work-id="' + String(m.work_id).replace(/"/g,'&quot;') + '"]');
        if (!card) return;
        // If gallery already gave us cover_image (codex MV row carries it), use directly.
        const direct = m.cover_image || m.preview_image_url || null;
        if (direct) {
          card.style.background = "url('" + String(direct).replace(/'/g,"%27") + "') center/cover, linear-gradient(135deg,#012019,#003a2c)";
          return;
        }
        __fetchWorkPublic(m.work_id).then(function (w) {
          if (!w) return;
          const img = w.cover_image || w.preview_image_url || w.poster_url || null;
          if (img) card.style.background = "url('" + String(img).replace(/'/g,"%27") + "') center/cover, linear-gradient(135deg,#012019,#003a2c)";
        });
      });
      // CSSOS_PHASE2_TEASER_CLICK 20260507 — Wave 2.6 polish — Jing
      // Click a teaser card → jump the queue to that work_id. If the
      // target is already in the queue, just seek to its index; otherwise
      // splice it in right after the current track and advance.
      teaser.querySelectorAll(".cinema-teaser-card").forEach(function (card) {
        card.addEventListener("click", function () {
          if (!cinemaSt) return;
          const wid = card.getAttribute("data-work-id");
          if (!wid) return;
          const existing = cinemaSt.queue.indexOf(wid);
          if (existing >= 0) {
            cinemaSt.idx = existing;
          } else {
            cinemaSt.queue.splice(cinemaSt.idx + 1, 0, wid);
            cinemaSt.idx += 1;
          }
          teaser.hidden = true;
          cinemaPlayCurrent();
        });
      });
    } catch (_e) {}
  }
  /* CSSOS_PERSON_MV_CINEMA_FIRST 20260507 — Jing
   * Full-bleed hero loading state shown whenever the cinema queue is
   * empty or before the first track has started. Person name is the
   * focal point; portrait (if any) lives behind it at low opacity.
   */
  function renderCinemaHeroLoading(stage, person) {
    if (!stage || !person) return;
    const loading = stage.querySelector(".cinema-loading");
    if (!loading) return;
    const esc = function (s) {
      return String(s == null ? "" : s)
        .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
    };
    const name = person.name || "";
    const sub = [person.nameEn, person.nameNative].filter(Boolean).join(" · ");
    const chips = [person.era, person.civ].filter(Boolean);
    const bgImg = person.portrait
      ? '<div class="cinema-hero-bg" style="background-image:url(\'' + String(person.portrait).replace(/'/g, "%27") + '\');"></div>'
      : '';
    // CSSOS_PERSON_MV_CINEMA_I18N 20260507 — Jing
    // Route the spinner copy through CSSOS_I18N.tr() (the canonical
    // helper). Fall back to globalThis.t() and finally to the zh
    // literal if neither is available. {name} is interpolated locally.
    let subtitleTpl = "Generating the first MV for {name}…";
    try {
      const i18n = globalThis.CSSOS_I18N;
      if (i18n && typeof i18n.tr === "function") {
        subtitleTpl = String(i18n.tr("Generating the first MV for {name}…"));
      } else if (typeof globalThis.t === "function") {
        subtitleTpl = String(globalThis.t("Generating the first MV for {name}…", "正在为 {name} 生成首支 MV…"));
      } else {
        subtitleTpl = "正在为 {name} 生成首支 MV…";
      }
    } catch (_e) {
      subtitleTpl = "正在为 {name} 生成首支 MV…";
    }
    const subtitle = String(subtitleTpl).replace("{name}", name || "—");
    // CSSOS_PERSON_MV_CINEMA_INTRO 20260507 — Jing
    // Person intro line (lore.bio first sentence > core_theme > roles).
    // Already truncated to ~80 chars upstream; clamp to 2 lines via CSS.
    const intro = person.intro ? esc(person.intro) : "";
    // CSSOS_PERSON_MV_CINEMA_PROGRESS 20260507 — Jing
    // Live pipeline progress block. Subscribes to `cssos:run_progress`
    // (per-stage 0..100 broadcast from the pipeline panel) and
    // `cssmv:stage-error` (failure surface). The listener is stashed on
    // cinemaSt._cleanup so exitCinemaMode can detach it.
    const trI18n = function (en, zh) {
      try {
        const i18n = globalThis.CSSOS_I18N;
        if (i18n && typeof i18n.tr === "function") return String(i18n.tr(en));
        if (typeof globalThis.t === "function") return String(globalThis.t(en, zh));
      } catch (_e) {}
      return zh;
    };
    const STAGE_META = [
      { id: "lyrics",   weight: 5,  icon: "✍️", en: "Lyrics",  zh: "写词" },
      { id: "music",    weight: 35, icon: "🎵", en: "Music",   zh: "配乐" },
      { id: "cover",    weight: 10, icon: "🖼️", en: "Cover",   zh: "封面" },
      { id: "video",    weight: 40, icon: "🎬", en: "Video",   zh: "视频" },
      { id: "compose",  weight: 10, icon: "🎞️", en: "Compose", zh: "合成" }
    ];
    loading.innerHTML =
      bgImg +
      '<div class="cinema-hero-block">' +
        '<div class="cinema-hero-name">' + esc(name) + '</div>' +
        (sub ? '<div class="cinema-hero-sub">' + esc(sub) + '</div>' : '') +
        (chips.length
          ? '<div class="cinema-hero-chips">' +
              chips.map(function (c) { return '<span class="cinema-hero-chip">' + esc(c) + '</span>'; }).join("") +
            '</div>'
          : '') +
        '<div class="cinema-hero-status-line">' + esc(subtitle) + '</div>' +
        '<div class="cinema-hero-progress" data-cinema-progress>' +
          '<div class="cinema-hero-progress-stages" data-cinema-progress-stages></div>' +
          '<div class="cinema-hero-progress-bar"><div class="cinema-hero-progress-fill" data-cinema-progress-fill></div></div>' +
          '<div class="cinema-hero-progress-pct" data-cinema-progress-pct>0%</div>' +
        '</div>' +
        (intro ? '<div class="cinema-hero-intro">' + intro + '</div>' : '') +
      '</div>';
    loading.hidden = false;

    // Wire listeners (idempotent — detach any prior listeners first).
    if (cinemaSt && typeof cinemaSt._cleanup === "function") {
      try { cinemaSt._cleanup(); } catch (_e) {}
      cinemaSt._cleanup = null;
    }
    const stagesEl = loading.querySelector("[data-cinema-progress-stages]");
    const fillEl = loading.querySelector("[data-cinema-progress-fill]");
    const pctEl = loading.querySelector("[data-cinema-progress-pct]");
    const statusEl = loading.querySelector(".cinema-hero-status-line");
    let lastPcts = { lyrics: 0, music: 0, cover: 0, video: 0, compose: 0 };
    const renderStages = function (pcts) {
      if (!stagesEl) return;
      stagesEl.innerHTML = STAGE_META.map(function (s) {
        const p = Math.max(0, Math.min(100, Math.round(pcts[s.id] || 0)));
        const tag = p >= 100 ? "✓" : (p > 0 ? (p + "%") : "…");
        const cls = p >= 100 ? "done" : (p > 0 ? "active" : "pending");
        return '<span class="cinema-hero-progress-chip ' + cls + '">' +
          s.icon + " " + esc(trI18n(s.en, s.zh)) + " " + tag + "</span>";
      }).join("");
      // CSSOS_MV_DAG_WAVE_2_7B — auto-scroll the active chip into view so
      // the running stage stays visible when chips overflow horizontally.
      try {
        const activeChip = stagesEl.querySelector(".cinema-hero-progress-chip.active");
        if (activeChip && typeof activeChip.scrollIntoView === "function") {
          activeChip.scrollIntoView({ inline: "center", block: "nearest", behavior: "smooth" });
        }
      } catch (_e) { /* non-fatal */ }
    };
    const computeOverall = function (pcts) {
      let total = 0, denom = 0;
      for (let i = 0; i < STAGE_META.length; i++) {
        const s = STAGE_META[i];
        const p = Math.max(0, Math.min(100, Number(pcts[s.id] || 0)));
        total += (p / 100) * s.weight;
        denom += s.weight;
      }
      return denom ? Math.round((total / denom) * 100) : 0;
    };
    const onProgress = function (ev) {
      try {
        const pr = ev && ev.detail && ev.detail.progress;
        if (!pr) return;
        // compose stage falls back to subtitles/kara if compose isn't set
        const composePct = (pr.compose != null) ? pr.compose : (pr.subtitles != null ? pr.subtitles : (pr.kara || 0));
        lastPcts = {
          lyrics: Number(pr.lyrics || 0),
          music: Number(pr.music || 0),
          cover: Number(pr.cover || 0),
          video: Number(pr.video || 0),
          compose: Number(composePct || 0),
        };
        const overall = computeOverall(lastPcts);
        if (fillEl) fillEl.style.width = overall + "%";
        if (pctEl) pctEl.textContent = overall + "%";
        renderStages(lastPcts);
      } catch (_e) {}
    };
    const onError = function (ev) {
      try {
        const det = (ev && ev.detail) || {};
        const stageId = det.stage || "";
        const meta = STAGE_META.find(function (m) { return m.id === stageId; });
        const stageLabel = meta ? trI18n(meta.en, meta.zh) : stageId;
        const failTpl = trI18n("Generation failed: {stage} ({msg})", "生成失败：{stage}（{msg}）");
        const retryLbl = trI18n("Retry", "重试");
        const msg = String(det.message || "").slice(0, 120);
        const txt = failTpl.replace("{stage}", stageLabel).replace("{msg}", msg);
        loading.innerHTML =
          bgImg +
          '<div class="cinema-hero-block">' +
            '<div class="cinema-hero-name">' + esc(name) + '</div>' +
            (sub ? '<div class="cinema-hero-sub">' + esc(sub) + '</div>' : '') +
            '<div class="cinema-hero-error">❌ ' + esc(txt) + '</div>' +
            '<div class="cinema-hero-error-actions">' +
              '<button type="button" class="cinema-hero-retry" data-cinema-retry>' + esc(retryLbl) + '</button>' +
            '</div>' +
          '</div>';
        const btn = loading.querySelector("[data-cinema-retry]");
        if (btn) {
          btn.addEventListener("click", function () {
            try {
              renderCinemaHeroLoading(stage, person);
              if (typeof globalThis.cssmvRunPipeline === "function" && cinemaSt) {
                globalThis.cssmvRunPipeline({ seed: cinemaSt.seed });
              }
            } catch (_e) {}
          });
        }
      } catch (_e) {}
    };
    try { window.addEventListener("cssos:run_progress", onProgress); } catch (_e) {}
    try { globalThis.addEventListener("cssmv:stage-error", onError); } catch (_e) {}
    if (cinemaSt) {
      cinemaSt._cleanup = function () {
        try { window.removeEventListener("cssos:run_progress", onProgress); } catch (_e) {}
        try { globalThis.removeEventListener("cssmv:stage-error", onError); } catch (_e) {}
      };
    }
    // Initial paint of stage chips at 0%.
    renderStages(lastPcts);
  }

  function ensureCinemaStyles() {
    if (document.getElementById("cssos-cinema-style")) return;
    const s = document.createElement("style");
    s.id = "cssos-cinema-style";
    s.textContent =
      /* CSSOS_PERSON_MV_CINEMA_FIRST_BUG1 20260507 — body-level overlay.
       * The pipeline panel itself is set to display:none during cinema,
       * so cinema cannot leak any chrome regardless of stale caches or
       * wrapper elements. The overlay is positioned over everything. */
      '#cssos-cinema-stage.cinema-fullscreen { position:fixed; inset:0; z-index:99999; background:#000; display:flex; align-items:center; justify-content:center; }' +
      '.panel[data-cinema="true"] { display:none !important; }' +
      /* Legacy panel-scoped rules kept as a defensive belt-and-braces
       * in case some build caches an older enterCinemaMode that mounts
       * the stage inside the panel-body. */
      '.panel[data-cinema="true"] .panel-bar,' +
      '.panel[data-cinema="true"] .mvp-action-bar,' +
      '.panel[data-cinema="true"] .mvp-settings,' +
      '.panel[data-cinema="true"] .mvp-stages,' +
      '.panel[data-cinema="true"] .mvp-cost,' +
      '.panel[data-cinema="true"] .mvp-inputs { display:none !important; }' +
      '.panel[data-cinema="true"] .panel-body { background:#000; padding:0; }' +
      '.panel[data-cinema="true"] .panel-body > *:not(.cinema-stage) { display:none !important; }' +
      '#cssos-cinema-stage, .panel[data-cinema="true"] .cinema-stage { position:fixed; inset:0; background:#000; display:flex; align-items:center; justify-content:center; }' +
      '#cssos-cinema-stage .cinema-video, .panel[data-cinema="true"] .cinema-video { width:100%; height:100%; object-fit:contain; background:#000; }' +
      '#cssos-cinema-stage .cinema-strip, .panel[data-cinema="true"] .cinema-strip { position:absolute; left:0; right:0; bottom:0; padding:8px 14px; color:#daffee; font:600 12px/1.3 ui-monospace,monospace; background:linear-gradient(transparent,rgba(0,0,0,.7)); text-align:center; }' +
      '#cssos-cinema-stage .cinema-loading, .panel[data-cinema="true"] .cinema-loading { position:absolute; inset:0; display:flex; align-items:center; justify-content:center; color:#daffee; }' +
      '#cssos-cinema-stage .cinema-hero-bg, .panel[data-cinema="true"] .cinema-hero-bg { position:absolute; inset:0; background-size:cover; background-position:center; opacity:.18; filter:blur(6px) saturate(1.05); }' +
      '#cssos-cinema-stage .cinema-hero-block, .panel[data-cinema="true"] .cinema-hero-block { position:relative; text-align:center; padding:0 24px; max-width:min(900px,92vw); }' +
      '#cssos-cinema-stage .cinema-hero-name, .panel[data-cinema="true"] .cinema-hero-name { font-weight:800; letter-spacing:.02em; font-size:clamp(40px,6vw,96px); line-height:1.05; color:#daffee; text-shadow:0 4px 30px rgba(0,245,160,.25); }' +
      '#cssos-cinema-stage .cinema-hero-sub, .panel[data-cinema="true"] .cinema-hero-sub { margin-top:14px; font-size:clamp(14px,1.4vw,20px); color:rgba(218,255,238,.62); letter-spacing:.04em; }' +
      '#cssos-cinema-stage .cinema-hero-chips, .panel[data-cinema="true"] .cinema-hero-chips { margin-top:18px; display:flex; gap:8px; justify-content:center; flex-wrap:wrap; }' +
      '#cssos-cinema-stage .cinema-hero-chip, .panel[data-cinema="true"] .cinema-hero-chip { font:600 12px/1 ui-monospace,monospace; padding:6px 10px; border-radius:999px; background:rgba(0,245,160,.10); border:1px solid rgba(0,245,160,.32); color:#9ff5cd; letter-spacing:.06em; }' +
      '#cssos-cinema-stage .cinema-hero-spinner, .panel[data-cinema="true"] .cinema-hero-spinner { margin-top:32px; display:flex; gap:12px; align-items:center; justify-content:center; color:rgba(218,255,238,.78); font:600 13px/1.3 ui-monospace,monospace; }' +
      '#cssos-cinema-stage .cinema-spin-ring, .panel[data-cinema="true"] .cinema-spin-ring { width:18px; height:18px; border-radius:50%; border:2px solid rgba(0,245,160,.25); border-top-color:#00f5a0; animation:cssos-cinema-spin 0.9s linear infinite; }' +
      '@keyframes cssos-cinema-spin { to { transform: rotate(360deg); } }' +
      '#cssos-cinema-stage .cinema-teaser, .panel[data-cinema="true"] .cinema-teaser { position:absolute; left:0; right:0; bottom:36px; padding:8px 14px; color:#daffee; }' +
      '#cssos-cinema-stage .cinema-teaser-label, .panel[data-cinema="true"] .cinema-teaser-label { font:700 11px/1 ui-monospace,monospace; color:#00f5a0; margin-bottom:6px; letter-spacing:.08em; }' +
      '#cssos-cinema-stage .cinema-teaser-row, .panel[data-cinema="true"] .cinema-teaser-row { display:flex; gap:8px; overflow-x:auto; }' +
      '#cssos-cinema-stage .cinema-teaser-card, .panel[data-cinema="true"] .cinema-teaser-card { flex:0 0 120px; aspect-ratio:16/9; background:rgba(255,255,255,.08); border:1px solid rgba(0,245,160,.3); border-radius:6px; display:flex; align-items:flex-end; justify-content:center; padding:4px; font:600 11px/1 ui-monospace,monospace; }' +
      'body[data-cinema="true"] #cssos-help-bubble,' +
      'body[data-cinema="true"] .cssos-help-bubble,' +
      'body[data-cinema="true"] .floating-help,' +
      'body[data-cinema="true"] .dock { opacity:0; pointer-events:none; transition:opacity .3s; }' +
      /* CSSOS_PERSON_MV_CINEMA_KARAOKE_CTRLS 20260507 — Jing
       * Keep the random-font / karaoke fancy-effect controls visible
       * during cinema. They control emotion karaoke subtitles and the
       * user explicitly wants to tweak them while watching. Lift above
       * the cinema overlay (z-index 99999). */
      'body[data-cinema="true"] #cssos-karaoke-settings { opacity:1 !important; pointer-events:auto !important; z-index:100000 !important; }' +
      /* Person-intro line under the spinner: small, fades, max 2 lines. */
      '.cinema-hero-intro { margin:14px auto 0; max-width:min(640px,82vw); font:400 13px/1.5 ui-serif,serif; color:rgba(218,255,238,.7); display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; text-align:center; }' +
      /* CSSOS_PERSON_MV_CINEMA_PROGRESS 20260507 — Jing
       * Live pipeline progress block: per-stage chips + thin rainbow bar
       * + overall percent. Mounted inside .cinema-hero-block. */
      '.cinema-hero-status-line { margin-top:28px; font:600 13px/1.4 ui-monospace,monospace; color:rgba(218,255,238,.85); letter-spacing:.04em; text-align:center; }' +
      '.cinema-hero-progress { margin:14px auto 0; max-width:680px; width:min(680px,94vw); display:flex; flex-direction:column; align-items:stretch; gap:8px; }' +
      /* CSSOS_MV_DAG_WAVE_2_7B 20260507 — Jing
       * Chip polish: pending=neutral gray (was faint green), labels never
       * overflow (min-width:max-content + flex:0 0 auto), container
       * scrolls horizontally with hidden scrollbar, active chip auto-
       * scrolls into view via JS scrollIntoView. */
      '.cinema-hero-progress-stages { display:flex; flex-wrap:nowrap; gap:6px; justify-content:flex-start; overflow-x:auto; scroll-snap-type:x mandatory; -webkit-overflow-scrolling:touch; scrollbar-width:none; padding:2px 4px; }' +
      '.cinema-hero-progress-stages::-webkit-scrollbar { display:none; }' +
      '.cinema-hero-progress-chip { font:600 11px/1 ui-monospace,monospace; padding:5px 8px; border-radius:999px; background:rgba(255,255,255,.04); border:1px solid rgba(255,255,255,.12); color:rgba(255,255,255,.45); letter-spacing:.04em; transition:background .25s,color .25s,border-color .25s; white-space:nowrap; flex:0 0 auto; min-width:max-content; scroll-snap-align:center; }' +
      '.cinema-hero-progress-chip.active { background:rgba(0,245,160,.16); border-color:rgba(0,245,160,.55); color:#daffee; }' +
      '.cinema-hero-progress-chip.done { background:rgba(0,245,160,.28); border-color:rgba(0,245,160,.85); color:#001a10; }' +
      '.cinema-hero-progress-bar { position:relative; height:6px; border-radius:999px; background:rgba(255,255,255,.08); overflow:hidden; }' +
      '.cinema-hero-progress-fill { height:100%; width:0%; background:linear-gradient(90deg,#ff5e62,#ff9966,#ffe066,#7afca6,#5cc8ff,#9b8cff,#ff5edc); background-size:200% 100%; animation:cssos-cinema-rainbow 6s linear infinite; transition:width .35s ease-out; }' +
      '@keyframes cssos-cinema-rainbow { 0% { background-position:0% 50%; } 100% { background-position:200% 50%; } }' +
      '.cinema-hero-progress-pct { font:700 12px/1 ui-monospace,monospace; color:rgba(218,255,238,.78); text-align:center; letter-spacing:.06em; }' +
      '.cinema-hero-error { margin-top:24px; font:600 14px/1.5 ui-monospace,monospace; color:#ff8585; max-width:min(560px,86vw); margin-left:auto; margin-right:auto; }' +
      '.cinema-hero-error-actions { margin-top:14px; display:flex; justify-content:center; }' +
      '.cinema-hero-retry { background:rgba(255,133,133,.12); border:1px solid rgba(255,133,133,.6); color:#ffb3b3; padding:8px 18px; border-radius:999px; font:700 12px/1 ui-monospace,monospace; letter-spacing:.06em; cursor:pointer; }' +
      '.cinema-hero-retry:hover { background:rgba(255,133,133,.22); color:#fff; }' +
      /* CSSOS_PERSON_MV_CINEMA_SUBS 20260507 — Jing
       * Emotion karaoke subtitle ticker overlay for cinema video. */
      '#cssos-cinema-stage .cinema-subs { position:absolute; left:0; right:0; bottom:64px; padding:0 24px; text-align:center; pointer-events:none; z-index:5; }' +
      '#cssos-cinema-stage .cinema-subs-line { display:inline-block; padding:8px 16px; border-radius:8px; background:rgba(0,0,0,.55); color:#fff; font:600 22px/1.4 ui-sans-serif,system-ui,sans-serif; text-shadow:0 2px 12px rgba(0,0,0,.7); max-width:min(960px,90vw); }';
    document.head.appendChild(s);
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
    // CSSOS_PHASE2_MV_CINEMA 20260507 — Wave 2.5
    // Cinema mode: maximize panel, hide chrome, autoplay queue of MVs.
    if (opts.cinema === true) {
      try { return enterCinemaMode(opts); } catch (err) {
        console.warn("[cinema] enter failed:", err);
      }
    }
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
      // CSSOS_PHASE2_OPEN_MAXIMIZED 20260505 — Jing
      // "MV PIPELINE面板还没有以最大化状态启动，请改进上下左右都
      //  撑满屏幕". Route through togglePanelMaximize so the panel
      // gets data-maximize-mode="fullscreen" + cleared inline styles
      // — without that, the CSS fullscreen rule doesn't match and
      // the panel stays in its prior floating size.
      try {
        if (panel.dataset.firstOpenMaximized !== "1" &&
            panel.dataset.userUnmaximized !== "1" &&
            panel.dataset.maximized !== "true" &&
            !panel.classList.contains("panel-collapsed") &&
            typeof globalThis.togglePanelMaximize === "function") {
          globalThis.togglePanelMaximize(panel);
          panel.dataset.firstOpenMaximized = "1";
        }
      } catch (_e) { /* non-fatal */ }
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
      // CSSOS_PERSON_MV_CINEMA_FIRST 20260507 — person seeds (those carrying
      // __personId) force-overwrite so the new "{name}\n[{intro}]" multiline
      // format always lands, even if the textarea has stale content.
      const isPersonSeed = !!opts.seed.__personId;
      if (promptEl && opts.seed.prompt && (isPersonSeed || !promptEl.value)) {
        promptEl.value = String(opts.seed.prompt);
        try { promptEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
      }
      if (styleEl && opts.seed.style && (isPersonSeed || !styleEl.value)) {
        styleEl.value = String(opts.seed.style);
        try { styleEl.dispatchEvent(new Event("input", { bubbles: true })); } catch (_e) {}
      }
      if (lyricsEl && opts.seed.lyrics && !lyricsEl.value) {
        lyricsEl.value = String(opts.seed.lyrics);
      } else if (lyricsEl && isPersonSeed) {
        // Person flow: always start blank — let LLM write fresh lyrics.
        lyricsEl.value = "";
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

  /* CSSOS_PHASE2_MV_WAVE6 20260507 — End-of-MV replay CTAs + style picker + Storm fan-out
   *
   * Three features layered on top of cinema mode:
   *  A. End-of-MV CTAs — 5s overlay shown when <video> finishes. Default
   *     highlight 再来一首; keys Space/S/F/Esc; auto-dismiss to next track.
   *  B. Style picker — 4×2 grid of preset style hints, click reruns the
   *     current seed with styleHint merged into seed.style.
   *  C. Storm mode — fans out 5 sequential fire-and-forget runs (each with
   *     a different style preset). True parallel was deferred — the existing
   *     runAll() pipeline guards against re-entry via state.running and shares
   *     panel-level inputs, so isolating per-run state slices was deemed too
   *     invasive for one wave. Sequential fan-out still gives the user the
   *     "5 versions to pick from" UX; ETA is ~5× a single run rather than 1×.
   */
  const WAVE6_STYLE_PRESETS = [
    { key: "tang",      icon: "🏯", label_zh: "唐风",     hint: "tang dynasty, guzheng, pipa, painterly" },
    { key: "cyber",     icon: "🌃", label_zh: "赛博朋克", hint: "cyberpunk neon, synthwave, neo-tokyo" },
    { key: "lofi",      icon: "🎷", label_zh: "Lo-fi",    hint: "lofi hip-hop, jazz piano, mellow" },
    { key: "rock",      icon: "🎸", label_zh: "摇滚",     hint: "indie rock, electric guitar, punchy drums" },
    { key: "cinematic", icon: "🎬", label_zh: "电影感",   hint: "cinematic orchestral, hans zimmer, dramatic" },
    { key: "jpop",      icon: "🌸", label_zh: "J-Pop",    hint: "j-pop, sparkling synth, anime vibes" },
    { key: "epic",      icon: "🔥", label_zh: "史诗",     hint: "epic orchestral, choir, taiko drums" },
    { key: "ambient",   icon: "🌊", label_zh: "氛围",     hint: "ambient, sparse pads, minimal" },
  ];

  function ensureWave6Styles() {
    if (document.getElementById("cssos-mv-wave6-style")) return;
    const s = document.createElement("style");
    s.id = "cssos-mv-wave6-style";
    s.textContent =
      ".w6-overlay{position:absolute;inset:0;background:rgba(0,0,0,.78);display:flex;flex-direction:column;align-items:center;justify-content:center;z-index:5;color:#daffee;padding:24px;}" +
      ".w6-cta-row{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;margin-top:18px;}" +
      ".w6-btn{all:unset;cursor:pointer;padding:12px 22px;border-radius:10px;border:1px solid rgba(0,245,160,.35);background:rgba(0,245,160,.08);font:700 14px/1 ui-monospace,monospace;color:#daffee;letter-spacing:.04em;}" +
      ".w6-btn.is-default{background:rgba(0,245,160,.22);border-color:#00f5a0;box-shadow:0 0 22px rgba(0,245,160,.35);}" +
      ".w6-btn:hover{background:rgba(0,245,160,.18);}" +
      ".w6-hint{margin-top:14px;font:500 11px/1.4 ui-monospace,monospace;color:rgba(218,255,238,.55);letter-spacing:.06em;}" +
      ".w6-countdown{font:800 48px/1 ui-monospace,monospace;color:#00f5a0;text-shadow:0 0 24px rgba(0,245,160,.5);margin-bottom:8px;}" +
      ".w6-style-grid{display:grid;grid-template-columns:repeat(4,minmax(120px,1fr));gap:12px;max-width:min(720px,92vw);}" +
      ".w6-style-chip{all:unset;cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:6px;padding:16px 8px;border-radius:10px;background:rgba(0,245,160,.08);border:1px solid rgba(0,245,160,.32);font:700 13px/1.2 ui-monospace,monospace;color:#daffee;text-align:center;}" +
      ".w6-style-chip:hover{background:rgba(0,245,160,.2);transform:translateY(-1px);}" +
      ".w6-style-icon{font-size:28px;line-height:1;}" +
      ".cinema-storm-grid{position:absolute;inset:0;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(2,1fr);gap:8px;padding:12px;background:#000;z-index:4;}" +
      ".cinema-storm-cell{position:relative;background:rgba(0,40,30,.7);border:1px solid rgba(0,245,160,.28);border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:14px;color:#daffee;font:600 12px/1.3 ui-monospace,monospace;overflow:hidden;}" +
      ".cinema-storm-cell.is-done{cursor:pointer;border-color:#00f5a0;background:rgba(0,80,55,.85);}" +
      ".cinema-storm-cell.is-done:hover{box-shadow:0 0 18px rgba(0,245,160,.45);}" +
      ".cinema-storm-cell.is-fail{border-color:#ff6464;color:#ffa8a8;}" +
      ".cinema-storm-cell.cinema-storm-info{grid-column:span 1;justify-content:flex-start;text-align:center;background:rgba(0,0,0,.55);}" +
      ".cinema-storm-cell-title{font-weight:800;font-size:14px;margin-bottom:6px;}" +
      ".cinema-storm-cell-status{font-size:11px;color:rgba(218,255,238,.7);}";
    document.head.appendChild(s);
  }

  function w6Esc(s) {
    return String(s == null ? "" : s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function clearW6Overlay(stage) {
    if (!stage) return;
    const ex = stage.querySelector(".w6-overlay");
    if (ex && ex.parentNode) ex.parentNode.removeChild(ex);
    if (cinemaSt && cinemaSt._w6KeyHandler) {
      document.removeEventListener("keydown", cinemaSt._w6KeyHandler, true);
      cinemaSt._w6KeyHandler = null;
    }
    if (cinemaSt && cinemaSt._w6Timer) { clearInterval(cinemaSt._w6Timer); cinemaSt._w6Timer = null; }
  }

  function showEndOfMvCtas(stage) {
    if (!cinemaSt || !stage) { return; }
    ensureWave6Styles();
    clearW6Overlay(stage);
    const overlay = document.createElement("div");
    overlay.className = "w6-overlay";
    overlay.innerHTML =
      '<div class="w6-countdown" data-w6-count>5</div>' +
      '<div style="font:600 14px/1.3 ui-monospace,monospace;color:rgba(218,255,238,.85);">本片已播完</div>' +
      '<div class="w6-cta-row">' +
        '<button class="w6-btn is-default" data-w6-act="replay">🔄 再来一首</button>' +
        '<button class="w6-btn" data-w6-act="style">🎲 换风格</button>' +
        '<button class="w6-btn" data-w6-act="storm">🔥 风暴模式</button>' +
        '<button class="w6-btn" data-w6-act="exit">← 退出</button>' +
      '</div>' +
      '<div class="w6-hint">Space=再来一首 · S=换风格 · F=风暴 · Esc=退出</div>';
    stage.appendChild(overlay);

    let userInteracted = false;
    let secs = 5;
    const countEl = overlay.querySelector("[data-w6-count]");
    const start = Date.now();
    cinemaSt._w6Timer = setInterval(function () {
      if (userInteracted) return;
      const elapsed = (Date.now() - start) / 1000;
      const remaining = Math.max(0, 5 - Math.floor(elapsed));
      if (countEl) countEl.textContent = String(remaining);
      if (remaining <= 0) {
        clearW6Overlay(stage);
        doW6Action("replay");
      }
    }, 200);

    function doW6Action(act) {
      clearW6Overlay(stage);
      if (act === "replay") {
        wave6ReplayCurrent({ randomStyle: true });
      } else if (act === "style") {
        showStylePicker(stage);
      } else if (act === "storm") {
        enterStormMode();
      } else if (act === "exit") {
        exitCinemaMode();
      }
    }

    overlay.querySelectorAll("[data-w6-act]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        userInteracted = true;
        doW6Action(btn.getAttribute("data-w6-act"));
      });
    });

    cinemaSt._w6KeyHandler = function (e) {
      if (e.key === " ") { userInteracted = true; e.preventDefault(); e.stopPropagation(); doW6Action("replay"); }
      else if (e.key === "s" || e.key === "S") { userInteracted = true; e.preventDefault(); e.stopPropagation(); doW6Action("style"); }
      else if (e.key === "f" || e.key === "F") { userInteracted = true; e.preventDefault(); e.stopPropagation(); doW6Action("storm"); }
      else if (e.key === "Escape") { userInteracted = true; e.preventDefault(); e.stopPropagation(); doW6Action("exit"); }
    };
    document.addEventListener("keydown", cinemaSt._w6KeyHandler, true);

    // Auto-dismiss within 1s of any keypress/click on the page.
    const dismissOnAct = function () {
      if (Date.now() - start < 1000) {
        userInteracted = true;
        clearW6Overlay(stage);
        cinemaSkip(+1);
      }
    };
    setTimeout(function () {
      document.removeEventListener("keydown", dismissOnAct, true);
      document.removeEventListener("click", dismissOnAct, true);
    }, 1000);
    document.addEventListener("keydown", dismissOnAct, true);
    document.addEventListener("click", dismissOnAct, true);
  }

  function pickRandomStyleHint() {
    const i = Math.floor(Math.random() * WAVE6_STYLE_PRESETS.length);
    return WAVE6_STYLE_PRESETS[i];
  }

  function wave6ReplayCurrent(opts) {
    if (!cinemaSt) return;
    opts = opts || {};
    const baseSeed = cinemaSt.seed || {};
    let styleHint = opts.styleHint || (opts.randomStyle ? pickRandomStyleHint().hint : "");
    const newSeed = Object.assign({}, baseSeed, {
      style: styleHint || baseSeed.style || "",
      styleHint: styleHint || null,
    });
    cinemaSt.seed = newSeed;
    cinemaSt.forceNew = true;
    // Clear queue and show hero loading; the existing run-finish listener
    // will push the new work_id and play.
    cinemaSt.queue = [];
    cinemaSt.idx = 0;
    const stage = cinemaSt.stage;
    if (stage) {
      const v = stage.querySelector(".cinema-video");
      if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (_e) {} }
      const loading = stage.querySelector(".cinema-loading");
      if (loading) loading.hidden = false;
      try { renderCinemaHeroLoading(stage, cinemaSt.person); } catch (_e) {}
      // Show style chip on hero for instant feedback.
      try {
        const chips = stage.querySelector(".cinema-hero-chips");
        if (chips && styleHint) {
          chips.insertAdjacentHTML("beforeend", '<span class="cinema-hero-chip">🎨 ' + w6Esc(styleHint.split(",")[0]) + '</span>');
        }
      } catch (_e) {}
    }
    try {
      if (typeof globalThis.cssmvRunPipeline === "function") {
        globalThis.cssmvRunPipeline({ seed: newSeed, fresh: true });
      }
    } catch (_e) {}
    const finishHandler = function (ev) {
      try {
        const wid = ev && ev.detail && (ev.detail.work_id || ev.detail.workId);
        if (wid && cinemaSt) {
          cinemaSt.queue.push(wid);
          const loading = stage && stage.querySelector(".cinema-loading");
          if (loading) loading.hidden = true;
          cinemaPlayCurrent();
        }
      } catch (_e) {}
    };
    globalThis.addEventListener("cssmv:run-finish", finishHandler, { once: true });
  }

  function showStylePicker(stage) {
    if (!cinemaSt || !stage) return;
    ensureWave6Styles();
    clearW6Overlay(stage);
    const overlay = document.createElement("div");
    overlay.className = "w6-overlay";
    overlay.innerHTML =
      '<div style="font:800 22px/1.2 ui-monospace,monospace;color:#daffee;margin-bottom:18px;">🎲 选一种风格</div>' +
      '<div class="w6-style-grid">' +
        WAVE6_STYLE_PRESETS.map(function (p) {
          return '<button class="w6-style-chip" data-w6-style="' + w6Esc(p.key) + '">' +
            '<span class="w6-style-icon">' + p.icon + '</span>' +
            '<span>' + w6Esc(p.label_zh) + '</span>' +
          '</button>';
        }).join("") +
      '</div>' +
      '<div class="w6-hint" style="margin-top:18px;">Esc 返回</div>';
    stage.appendChild(overlay);
    overlay.querySelectorAll("[data-w6-style]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        const k = btn.getAttribute("data-w6-style");
        const preset = WAVE6_STYLE_PRESETS.find(function (p) { return p.key === k; });
        clearW6Overlay(stage);
        if (preset) wave6ReplayCurrent({ styleHint: preset.hint });
      });
    });
    cinemaSt._w6KeyHandler = function (e) {
      if (e.key === "Escape") { e.preventDefault(); e.stopPropagation(); clearW6Overlay(stage); cinemaSkip(+1); }
    };
    document.addEventListener("keydown", cinemaSt._w6KeyHandler, true);
  }

  /* Storm mode — fan-out 5 runs with different style presets.
   * Sequential fire-and-forget through the existing pipeline (state.running
   * gates re-entry, so we serialize). Each completed run is captured via the
   * canonical cssmv:run-finish event and rendered in its grid cell. */
  function enterStormMode() {
    if (!cinemaSt) return;
    ensureWave6Styles();
    const stage = cinemaSt.stage;
    if (!stage) return;
    clearW6Overlay(stage);
    // Drop existing queue.
    const v = stage.querySelector(".cinema-video");
    if (v) { try { v.pause(); v.removeAttribute("src"); v.load(); } catch (_e) {} }
    cinemaSt.queue = [];
    cinemaSt.idx = 0;
    // Pick 5 unique random presets.
    const pool = WAVE6_STYLE_PRESETS.slice();
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      const tmp = pool[i]; pool[i] = pool[j]; pool[j] = tmp;
    }
    const picks = pool.slice(0, 5);
    // Build grid (3 cols × 2 rows; cell #6 = info/hint).
    let grid = stage.querySelector(".cinema-storm-grid");
    if (grid && grid.parentNode) grid.parentNode.removeChild(grid);
    grid = document.createElement("div");
    grid.className = "cinema-storm-grid";
    grid.innerHTML =
      picks.map(function (p, i) {
        return '<div class="cinema-storm-cell" data-storm-cell="' + i + '">' +
          '<div class="cinema-storm-cell-title">' + p.icon + ' ' + w6Esc(p.label_zh) + '</div>' +
          '<div class="cinema-storm-cell-status" data-storm-status>排队中…</div>' +
        '</div>';
      }).join("") +
      '<div class="cinema-storm-cell cinema-storm-info">' +
        '<div class="cinema-storm-cell-title">🔥 风暴模式</div>' +
        '<div class="cinema-storm-cell-status">5 个版本顺序生成中<br>完成后点击任意版本播放<br><br>Esc 取消风暴</div>' +
      '</div>';
    stage.appendChild(grid);
    // Hide hero loading if visible.
    const loading = stage.querySelector(".cinema-loading");
    if (loading) loading.hidden = true;

    const stormState = {
      picks: picks,
      results: new Array(5).fill(null), // { wid, status: 'pending'|'running'|'done'|'fail' }
      currentIdx: -1,
      cancelled: false,
      runFinishHandler: null,
    };
    cinemaSt._storm = stormState;

    function setCellStatus(i, text, klass) {
      const cell = grid.querySelector('[data-storm-cell="' + i + '"]');
      if (!cell) return;
      const st = cell.querySelector("[data-storm-status]");
      if (st) st.innerHTML = text;
      if (klass) cell.classList.add(klass);
    }

    function runNext() {
      if (stormState.cancelled) return;
      stormState.currentIdx += 1;
      if (stormState.currentIdx >= stormState.picks.length) {
        // All done.
        return;
      }
      const i = stormState.currentIdx;
      const preset = stormState.picks[i];
      setCellStatus(i, "生成中…");
      const seed = Object.assign({}, cinemaSt.seed || {}, { style: preset.hint, styleHint: preset.hint });
      const handler = function (ev) {
        if (stormState.cancelled) return;
        const wid = ev && ev.detail && (ev.detail.work_id || ev.detail.workId);
        if (wid) {
          stormState.results[i] = { wid: wid, status: "done" };
          setCellStatus(i, "✓ 完成 · 点击播放", "is-done");
          const cell = grid.querySelector('[data-storm-cell="' + i + '"]');
          if (cell) {
            cell.addEventListener("click", function () {
              if (stormState.cancelled) return;
              // Tear down storm grid; play this work in cinema.
              tearDownStorm();
              cinemaSt.queue = [wid];
              cinemaSt.idx = 0;
              cinemaPlayCurrent();
            });
            // Try to fetch cover for thumbnail.
            try {
              __fetchWorkPublic(wid).then(function (w) {
                if (!w) return;
                const img = w.cover_image || w.preview_image_url || w.poster_url;
                if (img) cell.style.background = "linear-gradient(rgba(0,80,55,.6),rgba(0,80,55,.6)), url('" + String(img).replace(/'/g, "%27") + "') center/cover";
              });
            } catch (_e) {}
          }
        } else {
          stormState.results[i] = { wid: null, status: "fail" };
          setCellStatus(i, "✗ 失败", "is-fail");
        }
        runNext();
      };
      stormState.runFinishHandler = handler;
      globalThis.addEventListener("cssmv:run-finish", handler, { once: true });
      try {
        if (typeof globalThis.cssmvRunPipeline === "function") {
          globalThis.cssmvRunPipeline({ seed: seed, fresh: true });
        }
      } catch (_e) {
        setCellStatus(i, "✗ 启动失败", "is-fail");
        runNext();
      }
    }

    function tearDownStorm() {
      stormState.cancelled = true;
      if (stormState.runFinishHandler) {
        try { globalThis.removeEventListener("cssmv:run-finish", stormState.runFinishHandler); } catch (_e) {}
      }
      const g = stage.querySelector(".cinema-storm-grid");
      if (g && g.parentNode) g.parentNode.removeChild(g);
      if (cinemaSt) cinemaSt._storm = null;
      if (cinemaSt && cinemaSt._stormKeyHandler) {
        document.removeEventListener("keydown", cinemaSt._stormKeyHandler, true);
        cinemaSt._stormKeyHandler = null;
      }
    }

    cinemaSt._stormKeyHandler = function (e) {
      if (e.key === "Escape") {
        e.preventDefault(); e.stopPropagation();
        tearDownStorm();
        // Fall back to hero loading if no queue.
        if (cinemaSt && cinemaSt.queue.length) cinemaPlayCurrent();
        else if (cinemaSt) renderCinemaHeroLoading(stage, cinemaSt.person);
      }
    };
    document.addEventListener("keydown", cinemaSt._stormKeyHandler, true);

    runNext();
  }

  // Expose for tests / external callers.
  globalThis.cssmvWave6 = {
    presets: WAVE6_STYLE_PRESETS,
    showEndOfMvCtas: showEndOfMvCtas,
    showStylePicker: showStylePicker,
    enterStormMode: enterStormMode,
    replayCurrent: wave6ReplayCurrent,
  };

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
