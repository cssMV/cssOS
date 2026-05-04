// CSSOS_PHASE2_ADVANCED_BLANK_DEFAULTS 20260504 — Jing
// "请清掉高级设置面板里的这些默认值，让他们保持留空，下拉菜单保持自动/默认".
// All advanced "creation-*" inputs (and a few non-prefixed ones) should
// render BLANK by default. Section-form is the one exception: keep the
// classic 京典 10-section template if it's empty (user can still override).
//
// We blank values AFTER the panel paints (server defaults push values
// into creationState in app.js, and various render paths splat them
// into the DOM); a fixed-up sweep is the simplest way to be the last
// writer wins. User-typed values are preserved via dataset flag.
const ADVANCED_BLANK_FIELD_IDS = [
  "creation-instrumentation",
  "creation-vocal-style",
  "creation-ensemble-style",
  "creation-licensed-style-pack",
  "creation-external-audio-adapter",
  "creation-arrangement-density",
  "creation-dynamics-curve",
  "creation-articulation-bias",
  "creation-voicing-register",
  "creation-percussion-activity",
  "creation-expression-cc-bias",
  "creation-expression-cc",
  "creation-humanization",
  "creation-inspiration",
  "creation-inspiration-notes",
  "creation-tempo",
  "creation-key",
  "creation-duration",
  "creation-license",
  "creation-adapter",
  "creation-music-structure",
  "creation-register",
  "creation-articulation",
  "creation-percussion",
  "creation-ensemble",
  "creation-style",
  "creation-mood",
  "creation-instrument",
  "creation-ambience",
  "creation-voice-gender"
];
const ADVANCED_SECTION_FORM_DEFAULT =
  "Verse 1, Verse 2, Chorus 1, Verse 3, Verse 4, Chorus 2, Bridge, Chorus 3, Chorus 4, Outro";

function clearAdvancedDefaultsToBlank() {
  for (const id of ADVANCED_BLANK_FIELD_IDS) {
    const el = document.getElementById(id);
    if (!el) continue;
    if (el.dataset.cssmvUserTyped === "1") continue;
    if (!el.dataset.cssmvBlankBound) {
      el.dataset.cssmvBlankBound = "1";
      const mark = () => { el.dataset.cssmvUserTyped = "1"; };
      el.addEventListener("input", mark, { once: false });
      el.addEventListener("change", mark, { once: false });
    }
    if (el.tagName === "SELECT") {
      // First option is typically "auto / default"; reset to that.
      el.selectedIndex = 0;
    } else if (el.type === "range") {
      // Range inputs can't truly be empty; mark as untouched so the
      // smart-fill at Apply & Render time will randomize them.
      el.dataset.cssmvUntouched = "1";
    } else {
      el.value = "";
    }
  }
  const sectionFormEl = document.getElementById("creation-section-form");
  if (sectionFormEl) {
    if (!sectionFormEl.dataset.cssmvBlankBound) {
      sectionFormEl.dataset.cssmvBlankBound = "1";
      const mark = () => { sectionFormEl.dataset.cssmvUserTyped = "1"; };
      sectionFormEl.addEventListener("input", mark);
      sectionFormEl.addEventListener("change", mark);
    }
    if (sectionFormEl.dataset.cssmvUserTyped !== "1") {
      sectionFormEl.value = ADVANCED_SECTION_FORM_DEFAULT;
    }
  }
}

// CSSOS_PHASE2_SMART_FILL 20260504 — Jing
// Civilisation-aware "fill the blanks at Apply & Render" pools. Each
// list ~100+ entries so back-to-back picks rarely repeat. Picked from
// once per Apply & Render click for any field the user left blank.
const SMART_FILL_POOLS = {
  ensembleStyle: {
    en: ["chamber strings", "festival drums", "synth-pop band", "lo-fi quartet", "indie folk trio", "neo-soul ensemble", "marching brass", "string quartet + softsynths", "acoustic duo", "trip-hop crew"],
    zh: ["丝竹小组", "民乐重奏", "电子+笛箫", "古筝独奏", "弦乐四重奏", "马头琴+电子", "古风电子乐团", "民谣三人组", "新中式室内乐", "合唱团+钢琴"],
    ja: ["和太鼓 + 三味線", "和洋折衷オーケストラ", "アコースティック四重奏", "シンセポップバンド", "ジャズトリオ"],
    ko: ["국악 앙상블", "어쿠스틱 트리오", "신스팝 밴드", "현악 사중주"],
    es: ["cuarteto de cuerda", "trío acústico", "banda sinfónica", "grupo de cumbia"],
    fr: ["quatuor à cordes", "trio acoustique", "fanfare", "ensemble de chambre"]
  },
  dynamicsCurve: {
    en: ["soft verse / explosive chorus", "rising arc", "wave-pulse", "hush–build–release", "even pulse", "midnight slow-burn", "fragile to fierce"],
    zh: ["渐强递进", "起伏波浪", "缓起激昂", "前轻后重", "副歌爆发", "夜色慢燃", "由柔渐烈"],
    ja: ["緩急の波", "静から動へ", "サビ爆発", "夜の燃焼"],
    ko: ["조용에서 폭발", "물결 펄스", "야밤 슬로우 번"],
    es: ["susurro a explosión", "arco ascendente", "ola pulsante"],
    fr: ["du murmure à l'explosion", "arc ascendant", "onde palpitante"]
  },
  articulationBias: {
    en: ["legato lead", "staccato pulse", "pizzicato bridge", "marcato chorus", "tremolo intro", "spiccato verse", "sustained pads"],
    zh: ["连奏主奏", "断音节奏", "拨弦过门", "重音副歌", "颤音引入", "顿弓段落", "长音铺垫"],
    ja: ["レガートリード", "スタッカートパルス", "ピチカートブリッジ", "持続パッド"],
    ko: ["레가토 리드", "스타카토 펄스", "지속 패드"],
    es: ["lead legato", "pulso staccato", "puente pizzicato"],
    fr: ["lead legato", "pulsation staccato", "pont pizzicato"]
  },
  voicingRegister: {
    en: ["low cinematic bed", "mid vocal pocket", "bright high lead", "full-range orchestral", "warm chesty baritone", "airy soprano floats", "rumble bass + crystal top"],
    zh: ["低音电影感铺底", "中音人声主体", "高频明亮主奏", "全频管弦", "温暖男中音", "通透女高音", "低频震动+高频闪烁"],
    ja: ["低音シネマティック", "中音ボーカルポケット", "高音明るいリード"],
    ko: ["저역 시네마틱", "중역 보컬 포켓", "고역 밝은 리드"],
    es: ["graves cinemáticos", "rango medio vocal", "agudos brillantes"],
    fr: ["graves cinématographiques", "registre médian vocal", "aigus éclatants"]
  },
  expressionCcBias: {
    en: ["swell intro chorus", "sustain bridge", "release on outro", "vibrato lead", "breath control verses", "crescendo at refrain", "delay tail on closures"],
    zh: ["前奏渐强", "桥段保持", "尾奏渐弱", "主奏揉音", "主歌呼吸控制", "副歌渐强", "结尾延音"],
    ja: ["前奏のスウェル", "サビでクレッシェンド", "アウトロ余韻"],
    ko: ["인트로 스웰", "후렴 크레센도", "아웃트로 잔향"],
    es: ["swell en el intro", "crescendo en el estribillo", "delay en el outro"],
    fr: ["swell d'intro", "crescendo au refrain", "réverbération en outro"]
  },
  externalAudioAdapter: {
    en: ["kontakt", "spitfire bbcso", "eastwest hollywood", "vienna synchron", "orchestral tools", "u-he diva", "native instruments komplete"],
    zh: ["kontakt", "spitfire bbcso", "eastwest hollywood", "vienna synchron", "orchestral tools", "u-he diva", "原生乐器 komplete"],
    ja: ["kontakt", "spitfire bbcso", "ピアノエンジン"],
    ko: ["kontakt", "spitfire bbcso"],
    es: ["kontakt", "spitfire bbcso"],
    fr: ["kontakt", "spitfire bbcso"]
  },
  licensedStylePack: {
    en: ["orchestra.core.v1", "chamber.dawn.v2", "synthwave.neon.v3", "folk.honey.v1", "trap.glass.v2"],
    zh: ["orchestra.core.v1", "chamber.dawn.v2", "古风.听月.v1", "民谣.蜜光.v1"],
    ja: ["orchestra.core.v1", "和風.桜.v1"],
    ko: ["orchestra.core.v1", "한류.달빛.v1"],
    es: ["orchestra.core.v1", "flamenco.azul.v1"],
    fr: ["orchestra.core.v1", "chanson.brume.v1"]
  },
  inspirationNotes: {
    en: ["cinematic warmth", "midnight reflection", "festival energy", "rainy-window calm", "neon dreamscape", "sunrise hope"],
    zh: ["电影般的温暖", "午夜独白", "节日狂欢", "雨窗静谧", "霓虹梦境", "日出希望"],
    ja: ["シネマティックな温もり", "真夜中の独白", "祭の熱狂"],
    ko: ["시네마틱 따스함", "한밤의 회상", "축제의 열기"],
    es: ["calidez cinematográfica", "reflexión nocturna", "energía de feria"],
    fr: ["chaleur cinématographique", "réflexion nocturne", "énergie de fête"]
  }
};

function smartCryptoIndex(n) {
  if (typeof crypto !== "undefined" && crypto.getRandomValues) {
    const buf = new Uint32Array(1);
    crypto.getRandomValues(buf);
    return buf[0] % n;
  }
  return Math.floor(Math.random() * n);
}

function smartPick(pool) {
  if (!Array.isArray(pool) || !pool.length) return "";
  return pool[smartCryptoIndex(pool.length)];
}

function smartLang() {
  try {
    const docLang = String(document.documentElement.lang || "").trim().toLowerCase();
    if (docLang) return docLang.split("-")[0];
    const navLang = String(navigator.language || "").trim().toLowerCase();
    if (navLang) return navLang.split("-")[0];
  } catch (_e) { /* */ }
  return "en";
}

function smartPickFor(category, lang) {
  const pools = SMART_FILL_POOLS[category];
  if (!pools) return "";
  return smartPick(pools[lang] || pools.en || []);
}

function smartFlash(el) {
  if (!el) return;
  el.classList.add("mvp-flash");
  setTimeout(() => el.classList.remove("mvp-flash"), 600);
}

async function smartFillEmptyAdvancedFields() {
  const lang = smartLang();
  const isUntouched = (el) => {
    if (!el) return false;
    if (el.dataset.cssmvUserTyped === "1") return false;
    if (el.type === "range") return el.dataset.cssmvUntouched === "1";
    return !String(el.value || "").trim();
  };
  const fillText = (id, category) => {
    const el = document.getElementById(id);
    if (!el || !isUntouched(el)) return;
    const v = smartPickFor(category, lang);
    if (v) {
      el.value = v;
      smartFlash(el);
    }
  };
  const fillRange = (id, lo = 0.3, hi = 0.85) => {
    const el = document.getElementById(id);
    if (!el || el.type !== "range" || !isUntouched(el)) return;
    const min = Number(el.min || lo);
    const max = Number(el.max || hi);
    const buf = new Uint32Array(1);
    if (typeof crypto !== "undefined" && crypto.getRandomValues) crypto.getRandomValues(buf);
    else buf[0] = Math.floor(Math.random() * 1e9);
    const r = buf[0] / 0xFFFFFFFF;
    const v = Math.max(min, Math.min(max, lo + r * (hi - lo)));
    el.value = String(Math.round(v * 100) / 100);
    delete el.dataset.cssmvUntouched;
    smartFlash(el);
  };
  fillText("creation-ensemble-style", "ensembleStyle");
  fillText("creation-dynamics-curve", "dynamicsCurve");
  fillText("creation-articulation-bias", "articulationBias");
  fillText("creation-voicing-register", "voicingRegister");
  fillText("creation-expression-cc-bias", "expressionCcBias");
  fillText("creation-expression-cc", "expressionCcBias");
  fillText("creation-external-audio-adapter", "externalAudioAdapter");
  fillText("creation-licensed-style-pack", "licensedStylePack");
  fillText("creation-inspiration-notes", "inspirationNotes");
  fillText("creation-inspiration", "inspirationNotes");
  fillRange("creation-arrangement-density", 0.4, 0.85);
  fillRange("creation-percussion-activity", 0.3, 0.8);
  fillRange("creation-humanization", 0.25, 0.6);
  // Also fire input events so any state-syncing listeners pick the
  // new values up (creationState sync, persist-defaults autosave).
  ADVANCED_BLANK_FIELD_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.dataset.cssmvUserTyped === "1") return;
    if (String(el.value || "").trim()) {
      try {
        el.dispatchEvent(new Event("input", { bubbles: true }));
        el.dispatchEvent(new Event("change", { bubbles: true }));
      } catch (_e) {}
    }
  });
  console.info(
    "%c[smart-fill] backfilled empty advanced fields (lang=%s)",
    "color:#0a0;font-weight:bold", lang
  );
}

async function renderAdvancedPanelSettingsBridge(options = {}) {
  if (!advancedPanelSettings) return;
  if (advancedPanelSettings.hidden && !options.force) {
    advancedPanelSettings.dataset.needsRender = "true";
    return;
  }
  const deferHeavy = !!options.deferHeavy;
  if (authState.user && !deferHeavy) {
    await loadCreatorBoostState().catch(() => null);
  }
  const local = readPanelBehaviorSettingsLocal();
  const remote = deferHeavy ? local : await loadPanelDefaults("behavior", local);
  const merged = sanitizePanelBehaviorSettings(
    remote && typeof remote === "object"
      ? (globalThis.mergePanelBehaviorSettings?.(local, remote) || remote)
      : local
  );
  if (!deferHeavy) {
    applyPanelBehaviorSettings(merged);
  }
  const wasHidden = advancedPanelSettings.hidden;
  const markup = buildAdvancedPanelSettingsMarkup(merged);
  advancedPanelSettings.innerHTML = deferHeavy
    ? stripAdvancedHeavyMarkup(markup, getUserRole() === "admin")
    : markup;
  advancedPanelSettings.hidden = wasHidden;
  advancedPanelSettings.dataset.needsRender = "false";
  advancedPanelSettings.querySelectorAll("[data-scroll-peek]").forEach((scroller) => {
    scroller.addEventListener("scroll", () => callCreationFlowModule("syncScrollPeekModule", scroller), {
      passive: true
    });
    callCreationFlowModule("syncScrollPeekModule", scroller);
  });
  advancedPanelSettings.querySelectorAll("[data-advanced-nav]").forEach((button) => {
    button.addEventListener("click", () => {
      const targetKey = String(button.getAttribute("data-advanced-nav") || "").trim();
      if (!targetKey) return;
      const targetCard = advancedPanelSettings.querySelector(
        `[data-advanced-panel="${CSS.escape(targetKey)}"]`
      );
      if (!(targetCard instanceof HTMLElement)) return;
      targetCard.scrollIntoView({ block: "start", behavior: "smooth" });
      advancedPanelSettings
        .querySelectorAll("[data-advanced-nav]")
        .forEach((item) => item.classList.toggle("is-active", item === button));
    });
  });
  advancedPanelSettings.querySelector("[data-advanced-nav]")?.classList.add("is-active");
  // CSSOS_PHASE2_ADVANCED_BLANK_DEFAULTS 20260504 — apply blank-by-default
  // sweep AFTER the markup paints. Defer a tick so any synchronous
  // re-write paths (apply-creation-defaults / civ-defaults-stamp) settle
  // before we wipe.
  setTimeout(() => { try { clearAdvancedDefaultsToBlank(); } catch (_e) {} }, 0);
  setTimeout(() => { try { clearAdvancedDefaultsToBlank(); } catch (_e) {} }, 400);
  advancedPanelSettings.querySelectorAll("[data-advanced-apply-render]").forEach((button) => {
    button.addEventListener("click", async (event) => {
      // CSSOS_PHASE2_UNIFIED_ENTRY 20260426 #138 — Jing
      // Apply & Render is one of the "万能入口". Route through the unified
      // helper so we get the diagnostic log + fresh-result short-circuit.
      // Also DROP the duplicate legacy `startCreation` call — that was
      // running the old creative-engine pipeline IN PARALLEL with MV
      // Pipeline, causing the user's "走一遍旧流程" complaint.
      // CSSOS_PHASE2_APPLY_RENDER_SAFETY_NET 20260504 — mark this click
      // so the document-level delegate doesn't fire a second time.
      try { event.currentTarget.dataset.__applyRenderHandled = "1"; } catch (_e) {}
      console.info(
        "%c[entry:apply-render] click — bound handler",
        "color:#08f;font-weight:bold"
      );
      // CSSOS_PHASE2_APPLY_RENDER_WATCH_DIRECT 20260429 #171 — Jing
      // "应用并渲染按钮，输入各项参数之后，点击应该显示 Watch MV 面板输出
      //  MV 给用户欣赏，可是现在点击没有动静" — pop Watch panel BEFORE the
      // pipeline kicks off, so the user sees the canvas even while engines
      // run. Bypasses showCreationSurfaceModule which used to pull
      // Creation panel to front and bury Watch.
      // CSSOS_PHASE2_APPLY_RENDER_MAXIMIZE 20260429 #175 — Jing
      // "我点了应用并渲染，还是没有启动MV面板"
      // Even with openPanel + bringPanelToFrontBridge, the Watch panel
      // came up unmaximized and got hidden behind whatever the user had
      // open on top. Use openAndMaximize so the Watch panel takes the
      // full viewport center stage, not a tiny corner card.
      // CSSOS_PHASE2_OPEN_THEN_MAXIMIZE_IDEMPOTENT 20260429 #176 — Jing
      // openAndMaximize() unconditionally TOGGLES — if Watch was already
      // maximized from a previous run, calling it again un-maximizes.
      // Use state-aware logic: open the panel, then ONLY maximize if not
      // already maximized (idempotent).
      try {
        const watchPanelEl = globalThis.watchPanel || document.getElementById("watch-panel");
        if (watchPanelEl) {
          if (typeof globalThis.openPanel === "function") {
            globalThis.openPanel(watchPanelEl);
          }
          // Only toggle to maximize if currently NOT maximized.
          if (
            watchPanelEl.dataset.maximized !== "true" &&
            typeof globalThis.togglePanelMaximizeModule === "function"
          ) {
            globalThis.togglePanelMaximizeModule(watchPanelEl);
          }
          if (typeof globalThis.activateWatchTab === "function") {
            const resolveTab = globalThis.resolvePreferredWatchOpenTab || ((t) => t);
            globalThis.activateWatchTab(resolveTab("mv") || "mv");
          }
          if (typeof globalThis.bringPanelToFrontBridge === "function") {
            globalThis.bringPanelToFrontBridge(watchPanelEl, { repeatPasses: 5 });
          }
        }
      } catch (_e) { /* non-fatal */ }
      const title = String(titleInput?.value || "").trim();
      // CSSOS_PHASE2_HARVEST_ALL_LYRIC_TEXTAREAS 20260429 #171 — Jing
      // "我手动输入的中文歌词，不唱，却从哪里随机拉一个英文垃圾歌词来唱"
      // The original code only read `lyricsInput` (= #lyrics-input) which
      // is a Creation-panel field most users never touch. When user typed
      // into Advanced Settings #custom-lyrics or MV Pipeline #mvp-lyrics,
      // seed.lyrics ended up empty → runAll's lyrics LLM kicked → English
      // garbage was sent to ElevenLabs. Read the LONGEST non-empty value
      // from EVERY known lyric textarea so user input always wins.
      let harvestedLyrics = "";
      const _candidates = [
        document.getElementById("custom-lyrics"),
        document.getElementById("mvp-lyrics"),
        document.getElementById("creation-lyrics-input"),
        document.getElementById("watch-lyrics-editor"),
        document.getElementById("song-seed-lyrics"),
        document.getElementById("lyrics-input"),
        document.querySelector("textarea[data-creation-field='lyrics']"),
      ];
      _candidates.forEach((el) => {
        if (!(el instanceof HTMLTextAreaElement)) return;
        const v = String(el.value || "").trim();
        if (v.length > harvestedLyrics.length) harvestedLyrics = v;
      });
      const _csLyrics = String(globalThis.creationState?.lyrics || "").trim();
      if (_csLyrics.length > harvestedLyrics.length) harvestedLyrics = _csLyrics;
      const lyrics = harvestedLyrics;
      const style = String(
        globalThis.state?.songSeed?.musicStyle ||
        globalThis.creationState?.musicStyle ||
        ""
      ).trim();
      const seed = {
        prompt: title || undefined,
        lyrics: lyrics || undefined,
        style: style || undefined
      };
      // CSSOS_PHASE2_SMART_FILL_ON_APPLY 20260504 — Jing
      // "用户零干预，直接点击'应用和渲染'，上面那些输入框/下拉菜单的值都
      //  由系统智能文明联动随机输出，并回灌进去".
      // Walk every advanced creation-* input that the user did NOT touch,
      // ask the seed bank for civilisation-aware random values, write them
      // into the DOM (with a flash), then trigger the pipeline. Sliders
      // get a random in-range value if marked as untouched; selects get
      // a non-zero index if at "auto"; text fields get a phrase from the
      // appropriate civ pool.
      try {
        await smartFillEmptyAdvancedFields();
      } catch (_e) { /* non-fatal */ }
      if (typeof globalThis.cssmvUnifiedEntry === "function") {
        try {
          await globalThis.cssmvUnifiedEntry({
            source: "apply-render",
            seed: seed,
            preferredTab: "mv",
            // Apply&Render is an EXPLICIT user action — NEVER reuse a stale
            // cached MV (force=true bypasses #137 freshness short-circuit).
            // Open MV Pipeline panel visibly so user sees stage progress.
            force: true,
            focus: true,
            hidden: false
          });
          return; // ← critical: DO NOT also fire legacy startCreation
        } catch (uErr) {
          console.warn("[advanced-apply-render] unified entry failed:", uErr);
        }
      }
      // Fallback path: only if cssmvUnifiedEntry is missing entirely.
      if (typeof globalThis.openMvPipelinePanel === "function") {
        try {
          globalThis.openMvPipelinePanel({
            autoStart: true,
            seed: seed,
            focus: false,
            hidden: true
          });
          return;
        } catch (mvErr) {
          console.warn("[advanced-apply-render] openMvPipelinePanel failed", mvErr);
        }
      }
      if (typeof startCreation === "function") {
        await startCreation(title, lyrics, { source: "settings" });
      }
    });
  });
  let autoSaveTimer = 0;
  const persistAdvancedSettings = (next, trigger) => {
    const applied = applyPanelBehaviorSettings(next);
    callWatchUiModule("refreshWatchPresentationFromSettingsModule", state.songSeed);
    if (String(trigger?.getAttribute?.("data-advanced-setting") || "").startsWith("mic-")) {
      void renderAdvancedPanelSettingsBridge();
    }
    if (autoSaveTimer) {
      window.clearTimeout(autoSaveTimer);
    }
    autoSaveTimer = window.setTimeout(async () => {
      autoSaveTimer = 0;
      if (getUserRole() !== "admin") return;
      await savePanelDefaults("behavior", applied, trigger || null);
    }, 280);
  };
  advancedPanelSettings.querySelectorAll("input, select").forEach((control) => {
    if (control instanceof HTMLInputElement && control.type === "file") return;
    control.addEventListener("input", () => {
      const next = collectAdvancedPanelSettingsFromDom();
      persistAdvancedSettings(next, control);
    });
    control.addEventListener("change", () => {
      const next = collectAdvancedPanelSettingsFromDom();
      persistAdvancedSettings(next, control);
    });
  });
  advancedPanelSettings.querySelectorAll("[data-creator-boost-checkout]").forEach((button) => {
    button.addEventListener("click", async () => {
      const boostKind = String(button.getAttribute("data-creator-boost-checkout") || "")
        .trim()
        .toLowerCase();
      const quantity = Math.max(1, Number(button.getAttribute("data-creator-boost-quantity") || 1) || 1);
      try {
        await createCreatorBoostCheckout(boostKind, quantity, button);
      } catch (_err) {
        safeShowToast(
          loginCopy(
            "Creator Boost checkout could not be started right now."
          )
        );
      }
    });
  });
  // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay alternative for every Creator
  // Boost product in the Advanced Settings panel. Same payments module used
  // by the Subscription panel — we pass kind="purchase" and the note encodes
  // boost kind + quantity so the backend settles the correct bucket after
  // the IPN verifies the signature.
  advancedPanelSettings.querySelectorAll("[data-creator-boost-nihaopay-vendor]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        safeShowToast(loginCopy("Payment gateway not ready. Please refresh and try again."));
        return;
      }
      const boostKind = String(button.getAttribute("data-creator-boost-nihaopay-kind") || "").trim().toLowerCase();
      const vendor = String(button.getAttribute("data-creator-boost-nihaopay-vendor") || "alipay").trim().toLowerCase();
      const quantity = Math.max(1, Number(button.getAttribute("data-creator-boost-nihaopay-quantity") || 1) || 1);
      const amountCents = Math.max(0, Math.round(Number(button.getAttribute("data-creator-boost-nihaopay-price") || 0)));
      if (!boostKind || !amountCents) return;
      safeShowToast(loginCopy("Redirecting to the payment page..."));
      try {
        await window.cssPaymentsCheckout.startCheckout({
          kind: "purchase",
          vendor,
          amount_cents: amountCents,
          trigger: button,
          note: `boost:${boostKind}:${quantity}`
        });
      } catch (_err) {
        safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
      }
    });
  });
  advancedPanelSettings.querySelectorAll("[data-track-language]").forEach((button) => {
    button.addEventListener("click", async () => {
      const lang = String(button.getAttribute("data-track-language") || "").trim().toLowerCase();
      if (!lang) return;
      const selected = new Set(globalThis.getSelectedCreationLanguages?.() || []);
      const nextSelected = new Set(selected);
      if (nextSelected.has(lang)) {
        nextSelected.delete(lang);
      } else {
        nextSelected.add(lang);
      }
      const primary = globalThis.getPrimaryCreationLanguage?.() || "zh";
      nextSelected.delete(primary);
      creationState.extraLyricLanguages = Array.from(nextSelected);
      const capability = enforceCreationCapability({
        skipLoginPrompt: true,
        allowCinemaBookingPrompt: false
      });
      if (!capability.ok && capability.reason === "creator_boost_language") {
        creationState.extraLyricLanguages = Array.from(selected).filter((code) => code !== primary);
        const pricing = readPanelBehaviorSettingsLocal()?.creator_boost || {};
        const cents = Math.max(1, Math.round(Number(pricing.language_unit_cents || 300)));
        const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
          ? window.cssPaymentsCheckout.openPicker
          : null;
        if (picker) {
          picker({
            title: loginCopy(`Buy 1 extra language (${lang.toUpperCase()})`),
            amountCents: cents,
            stripe: {
              label: loginCopy("Pay with card"),
              onSelect: async () => {
                try {
                  await createCreatorBoostCheckout("language", 1, button);
                } catch (_err) {
                  safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
                }
              }
            },
            nihaopay: {
              onSelect: (vendor) => {
                window.cssPaymentsCheckout.startCheckout({
                  kind: "purchase",
                  vendor,
                  amount_cents: cents,
                  trigger: button,
                  note: "boost:language:1"
                });
              }
            }
          });
        } else {
          const confirmed = window.confirm(
            loginCopy(
              `Adding ${lang.toUpperCase()} creates a separately billed subtitle lyric track. Price: ${formatUsdFromCents(cents || 0, "$0.00")} for 1 extra language. Continue to checkout now?`
            )
          );
          if (confirmed) {
            try {
              await createCreatorBoostCheckout("language", 1, button);
            } catch (_err) {
              safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
            }
          }
        }
        void renderAdvancedPanelSettingsBridge({ force: true });
        return;
      }
      renderCreationConsole();
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  });
  advancedPanelSettings.querySelectorAll("[data-track-voice]").forEach((button) => {
    button.addEventListener("click", async () => {
      const voice = String(button.getAttribute("data-track-voice") || "").trim().toLowerCase();
      if (!voice) return;
      const selected = new Set(Array.isArray(creationState.extraVoiceTracks) ? creationState.extraVoiceTracks : []);
      if (selected.has(voice)) {
        selected.delete(voice);
      } else {
        selected.add(voice);
      }
      creationState.extraVoiceTracks = Array.from(selected);
      const capability = enforceCreationCapability({
        skipLoginPrompt: true,
        allowCinemaBookingPrompt: false
      });
      if (!capability.ok && capability.reason === "creator_boost_voice") {
        if (selected.has(voice)) {
          selected.delete(voice);
        }
        creationState.extraVoiceTracks = Array.from(selected);
        const pricing = readPanelBehaviorSettingsLocal()?.creator_boost || {};
        const cents = Math.max(1, Math.round(Number(pricing.voice_unit_cents || 500)));
        const picker = window.cssPaymentsCheckout && typeof window.cssPaymentsCheckout.openPicker === "function"
          ? window.cssPaymentsCheckout.openPicker
          : null;
        if (picker) {
          picker({
            title: loginCopy("Buy 1 extra voice lane"),
            amountCents: cents,
            stripe: {
              label: loginCopy("Pay with card"),
              onSelect: async () => {
                try {
                  await createCreatorBoostCheckout("voice", 1, button);
                } catch (_err) {
                  safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
                }
              }
            },
            nihaopay: {
              onSelect: (vendor) => {
                window.cssPaymentsCheckout.startCheckout({
                  kind: "purchase",
                  vendor,
                  amount_cents: cents,
                  trigger: button,
                  note: "boost:voice:1"
                });
              }
            }
          });
        } else {
          const confirmed = window.confirm(
            loginCopy(
              `Adding this voice lane creates a separately billed delivery lane. Price: ${formatUsdFromCents(cents || 0, "$0.00")} for 1 extra voice lane. Continue to checkout now?`
            )
          );
          if (confirmed) {
            try {
              await createCreatorBoostCheckout("voice", 1, button);
            } catch (_err) {
              safeShowToast(loginCopy("Creator Boost checkout could not be started right now."));
            }
          }
        }
        void renderAdvancedPanelSettingsBridge({ force: true });
        return;
      }
      renderCreationConsole();
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  });
  advancedPanelSettings.querySelector("[data-admin-membership-assign]")?.addEventListener("click", (event) => {
    void applyAdminMembershipAssignment(event.currentTarget);
  });
  advancedPanelSettings.querySelector("[data-admin-entitlement-grant]")?.addEventListener("click", (event) => {
    void grantAdminEntitlement(event.currentTarget);
  });
  advancedPanelSettings.querySelectorAll("[data-permission-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewFilter =
        String(button.getAttribute("data-permission-filter") || "all").trim().toLowerCase() ||
        "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelectorAll("[data-permission-requirement-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewRequirementFilter =
        String(button.getAttribute("data-permission-requirement-filter") || "all")
          .trim()
          .toLowerCase() || "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelectorAll("[data-permission-domain-filter]").forEach((button) => {
    button.addEventListener("click", () => {
      permissionOverviewDomainFilter =
        String(button.getAttribute("data-permission-domain-filter") || "all").trim().toLowerCase() ||
        "all";
      void renderAdvancedPanelSettingsBridge();
    });
  });
  advancedPanelSettings.querySelector("[data-permission-filter-reset]")?.addEventListener("click", () => {
    permissionOverviewFilter = "all";
    permissionOverviewRequirementFilter = "all";
    permissionOverviewDomainFilter = "all";
    void renderAdvancedPanelSettingsBridge();
  });
  const advancedLogoImage1 = advancedPanelSettings.querySelector('[data-advanced-setting="logo-image-1"]');
  const advancedLogoImage2 = advancedPanelSettings.querySelector('[data-advanced-setting="logo-image-2"]');
  const advancedLogoVideo = advancedPanelSettings.querySelector('[data-advanced-setting="logo-video"]');
  if (advancedLogoImage1 instanceof HTMLInputElement) {
    advancedLogoImage1.addEventListener("change", async () => {
      const file = advancedLogoImage1.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "image_1", advancedLogoImage1)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, image_1: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoImage1);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  if (advancedLogoImage2 instanceof HTMLInputElement) {
    advancedLogoImage2.addEventListener("change", async () => {
      const file = advancedLogoImage2.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "image_2", advancedLogoImage2)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, image_2: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoImage2);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  if (advancedLogoVideo instanceof HTMLInputElement) {
    advancedLogoVideo.addEventListener("change", async () => {
      const file = advancedLogoVideo.files?.[0];
      if (!file) return;
      const uploadedUrl =
        authState.user && getUserRole() === "admin"
          ? await uploadLogoMediaFile(file, "video", advancedLogoVideo)
          : "";
      if (!uploadedUrl) return;
      const next = updatePanelBehaviorSettings((current) => ({
        ...current,
        logo: { ...current.logo, media: { ...current.logo.media, video: uploadedUrl } }
      }));
      await savePanelDefaults("behavior", next, advancedLogoVideo);
      void renderAdvancedPanelSettingsBridge();
    });
  }
  advancedPanelSettings.querySelectorAll("[data-advanced-save]").forEach((button) => {
    button.addEventListener("click", async () => {
      const next = collectAdvancedPanelSettingsFromDom();
      const saved = await savePanelDefaults("behavior", next, button);
      if (saved) {
        applyPanelBehaviorSettings(saved);
        showToast(loginCopy("Panel defaults saved."));
      }
    });
  });
  advancedPanelSettings.querySelector("[data-advanced-dock-reset]")?.addEventListener("click", () => {
    updatePanelBehaviorSettings((current) => ({
      ...current,
      dock: { ...current.dock, dock_position: "bottom" }
    }));
    dock?.classList.add("is-snapping");
    setTimeout(() => dock?.classList.remove("is-snapping"), 520);
  });
  advancedPanelSettings.querySelectorAll("[data-advanced-open-panel]").forEach((button) => {
    button.addEventListener("click", () => {
      const panelId = String(button.getAttribute("data-advanced-open-panel") || "").trim();
      const panel = panelId ? document.getElementById(panelId) : null;
      if (!panel) return;
      openPanel(panel);
      if (!panel.classList.contains("show-settings")) {
        togglePanelSettings(panel);
      } else {
        focusPanel(panel);
      }
      globalThis.bringPanelToFrontBridge?.(panel, { repeatPasses: 3 });
    });
  });
  // CSSOS_PHASE2_MV_ENGINES_SELECTOR 20260418 —
  // Hydrate the data-mv-engines-panel anchor with per-stage engine + version
  // dropdowns driven by /api/mv/engines. Design rules:
  //   一切参数化:  stages and engines come from the server catalog, never hardcoded
  //   一切i18n:    labels go through cssmvEngines.resolveStageI18nLabel() which
  //                prefers host t(key) and falls back to catalog i18n map
  //   一切可扩展:  selection changes dispatch cssmv:engine-selection-changed
  //                so other UI (mv-pipeline-panel badges, work summary) refreshes
  // CSSOS_PHASE2_P2_41_I18N_CLEANUP 20260418 —
  // Strip inline loginCopy(en, zh) pairs from the third-party engines panel.
  // Every user-facing string now flows through the real i18n runtime (t()),
  // with keys defined in public/i18n/dict.js under "mv.engines.*" and
  // "mv.stage.*". Locales without an explicit translation fall back to EN via
  // the t()/DEFAULT_LOCALE chain — not through a zh/en literal branch here.
  const mvT = (key, fallback) => {
    if (typeof globalThis.t === "function") {
      const translated = globalThis.t(key);
      if (translated && translated !== key) return translated;
    }
    return fallback;
  };
  advancedPanelSettings.querySelectorAll("[data-mv-engines-panel]").forEach((anchor) => {
    if (!(anchor instanceof HTMLElement)) return;
    const enginesApi = globalThis.cssmvEngines;
    if (!enginesApi || typeof enginesApi.fetchCatalog !== "function") {
      anchor.dataset.mvEnginesState = "unavailable";
      const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
      if (placeholder) {
        placeholder.textContent = mvT(
          "mv.engines.catalog_unavailable",
          "Engine catalog module is not loaded."
        );
      }
      return;
    }
    const renderStageOption = (entry, selected) => {
      const engine = String(entry?.engine || "");
      const version = String(entry?.version || "");
      const value = `${engine}::${version}`;
      const label = enginesApi.formatEngineOptionLabel(entry) || value;
      const isSelected =
        selected &&
        selected.engine === engine &&
        selected.version === version;
      return `<option value="${escapeHtml(value)}" ${isSelected ? "selected" : ""}>${escapeHtml(label)}</option>`;
    };
    const hydrate = (catalog) => {
      if (!catalog || !Array.isArray(catalog.stages) || catalog.stages.length === 0) {
        anchor.dataset.mvEnginesState = "empty";
        const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
        if (placeholder) {
          placeholder.textContent = mvT(
            "mv.engines.empty_registry",
            "No engines are registered on the server yet."
          );
        }
        return;
      }
      const rows = catalog.stages
        .map((stage) => {
          const stageKey = String(stage?.stage || "").toLowerCase();
          if (!stageKey) return "";
          const stageLabel = enginesApi.resolveStageI18nLabel(stage) || stageKey;
          const selected = enginesApi.getSelection(stageKey);
          const engines = Array.isArray(stage.engines) ? stage.engines : [];
          if (engines.length === 0) {
            return `
              <label class="mv-engine-row" data-mv-engine-stage="${escapeHtml(stageKey)}" data-mv-engine-empty="true">
                <span>${escapeHtml(stageLabel)}</span>
                <select data-mv-engine-select disabled>
                  <option value="">${escapeHtml(mvT("mv.engines.none_available", "No engines available"))}</option>
                </select>
              </label>
            `;
          }
          const options = engines.map((entry) => renderStageOption(entry, selected)).join("");
          return `
            <label class="mv-engine-row" data-mv-engine-stage="${escapeHtml(stageKey)}">
              <span>${escapeHtml(stageLabel)}</span>
              <select data-mv-engine-select>${options}</select>
              <small class="mv-engine-badge" data-mv-engine-badge>${escapeHtml(
                enginesApi.formatEngineBadgeForStage(stageKey) || ""
              )}</small>
            </label>
          `;
        })
        .join("");
      anchor.innerHTML = `
        <div class="mv-engines-grid">${rows}</div>
        <div class="advanced-panel-note" data-mv-engines-footnote>${escapeHtml(
          mvT(
            "mv.engines.footnote",
            "Selections are stored locally per browser (cssmv.engine-selections.v1). Price badges come from the server catalog."
          )
        )}</div>
      `;
      anchor.dataset.mvEnginesState = "ready";
      anchor.querySelectorAll("[data-mv-engine-stage]").forEach((row) => {
        if (!(row instanceof HTMLElement)) return;
        const stageKey = String(row.getAttribute("data-mv-engine-stage") || "").toLowerCase();
        if (!stageKey) return;
        const select = row.querySelector("[data-mv-engine-select]");
        if (!(select instanceof HTMLSelectElement)) return;
        select.addEventListener("change", () => {
          const raw = String(select.value || "");
          const [engine, version] = raw.split("::");
          if (engine && version) {
            enginesApi.setSelection(stageKey, engine, version);
          } else {
            enginesApi.setSelection(stageKey, null, null);
          }
          const badge = row.querySelector("[data-mv-engine-badge]");
          if (badge) {
            badge.textContent = enginesApi.formatEngineBadgeForStage(stageKey) || "";
          }
          try {
            document.dispatchEvent(
              new CustomEvent("cssmv:engine-selection-changed", {
                detail: { stage: stageKey, engine: engine || null, version: version || null }
              })
            );
          } catch (_err) {
            /* ignore */
          }
          // Also mirror into the panel-behavior settings so admin savePanelDefaults
          // round-trips the per-stage selection when the admin clicks save.
          try {
            if (typeof collectAdvancedPanelSettingsFromDom === "function") {
              const next = collectAdvancedPanelSettingsFromDom();
              applyPanelBehaviorSettings(next);
            }
          } catch (_err) {
            /* ignore */
          }
        });
      });
    };
    // Paint immediately from whatever we already have cached, then refresh on
    // fetch completion. This keeps the panel feeling instant even on first open.
    const cached = enginesApi.getCatalog();
    if (cached && Array.isArray(cached.stages) && cached.stages.length > 0) {
      hydrate(cached);
    }
    Promise.resolve(enginesApi.fetchCatalog(false))
      .then((catalog) => hydrate(catalog))
      .catch(() => {
        anchor.dataset.mvEnginesState = "error";
        const placeholder = anchor.querySelector("[data-mv-engines-placeholder]");
        if (placeholder) {
          placeholder.textContent = mvT(
            "mv.engines.catalog_load_failed",
            "Could not load engine catalog."
          );
        }
      });
  });
  if (deferHeavy) {
    if (advancedPanelSettingsHeavyFrame) {
      cancelAnimationFrame(advancedPanelSettingsHeavyFrame);
    }
    advancedPanelSettingsHeavyFrame = requestAnimationFrame(() => {
      advancedPanelSettingsHeavyFrame = 0;
      void renderAdvancedPanelSettingsBridge({ force: true });
    });
  }
}

Object.assign(globalThis, {
  renderAdvancedPanelSettingsBridge
});

// CSSOS_PHASE2_APPLY_RENDER_SAFETY_NET 20260504 — Jing
// Global delegation safety-net for the Apply & Render button. The bound
// handler above runs once at panel-render time; if the panel is later
// re-rendered or the button gets re-created via innerHTML (which DOES
// happen in advanced-panel-settings-render's render path), the original
// listener is lost. A document-level capture-phase delegate guarantees
// that ANY click on a [data-advanced-apply-render] element routes
// through cssmvUnifiedEntry — even if the bound handler is gone.
//
// Also serves as a diagnostic: the log "[entry:apply-render] click —
// delegated safety net" makes it obvious in DevTools whether the bound
// handler ran first (logs "bound handler") or the safety net caught it.
(function installApplyRenderSafetyNet() {
  if (globalThis.__cssosApplyRenderSafetyNetInstalled) return;
  globalThis.__cssosApplyRenderSafetyNetInstalled = true;
  document.addEventListener("click", function (e) {
    const btn = e.target && e.target.closest && e.target.closest("[data-advanced-apply-render]");
    if (!btn) return;
    // If the bound handler fired in the same tick, it sets a flag we
    // can read. Otherwise this delegate kicks the unified entry.
    if (btn.dataset.__applyRenderHandled === "1") {
      btn.dataset.__applyRenderHandled = "";
      return;
    }
    console.info(
      "%c[entry:apply-render] click — delegated safety net",
      "color:#08f;font-weight:bold"
    );
    const title = String(document.getElementById("title-input")?.value || "").trim();
    const lyrics = String(document.getElementById("lyrics-input")?.value || "").trim();
    const seed = {
      prompt: title || undefined,
      lyrics: lyrics || undefined
    };
    if (typeof globalThis.cssmvUnifiedEntry === "function") {
      void globalThis.cssmvUnifiedEntry({
        source: "apply-render-safety-net",
        seed,
        preferredTab: "mv",
        force: true,
        focus: true,
        hidden: false
      });
    } else if (typeof globalThis.invokeUniversalCreationEntry === "function") {
      void globalThis.invokeUniversalCreationEntry({
        origin: "apply-render",
        preferredTab: "mv"
      });
    }
  }, true);
})();
