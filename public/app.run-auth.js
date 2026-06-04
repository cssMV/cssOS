function updateEnginePanelsBridge(title, lines) {
  const style = styleInput ? styleInput.value : state.style;
  const voice = voiceInput ? voiceInput.value : state.voice;
  const scenes = groupScenes(lines);
  const sceneSemanticDetails = [
    loginCopy("opening image is being caught"),
    loginCopy("relationship is widening into shared motion"),
    loginCopy("the ending is learning what to answer")
  ];
  const resolvedScenes = scenes.length
    ? scenes.map((scene, index) => ({
        ...scene,
        detail: sceneSemanticDetails[index % sceneSemanticDetails.length]
      }))
    : [{
        title: "Scene 1 · Flow",
        lines: lines.filter(Boolean).slice(0, 3),
        detail: loginCopy("opening image is being caught")
      }];
  const shots = buildShots(resolvedScenes.length);
  const stats = [
    { label: "Tempo", value: `${72 + Math.floor(Math.random() * 26)} BPM` },
    { label: "Energy", value: `${70 + Math.floor(Math.random() * 25)}%` },
    { label: "Render", value: `${84 + Math.floor(Math.random() * 12)}%` },
    { label: "Sync", value: `${88 + Math.floor(Math.random() * 10)}%` }
  ];
  const styleTags = buildStyleTags(style, voice);
  const mvTagSet = [...new Set([...styleTags, ...pickRandom(mvTagBank, 2)])];
  const videoTagSet = [...new Set([...pickRandom(videoTagBank, 3), ...pickRandom(mvTagBank, 1)])];

  if (mvTitle) mvTitle.textContent = title;
  if (foryouTitle) foryouTitle.textContent = title;
  if (foryouStyle) foryouStyle.textContent = `${style} · ${voice}`;
  if (mvSub) {
    mvSub.textContent = `${resolvedScenes.length} ${loginCopy("moments")} · ${shots.length} ${loginCopy("glances")} · Live Karaoke`;
  }
  if (videoScript) {
    videoScript.textContent = loginCopy(
      `Scene drift is ready · ${resolvedScenes.length} moments are waiting to enter`
    );
  }
  if (musicStyle) musicStyle.textContent = style;
  if (voiceStyle) voiceStyle.textContent = voice;
  syncForyouActionButtons();

  renderSceneList(resolvedScenes);
  renderLyricsGrid(resolvedScenes);
  renderTags(mvTags, mvTagSet);
  renderStats(mvStats, stats);
  renderCameraBoard(resolvedScenes);
  renderLyricFlow(resolvedScenes);
  renderTags(musicTags, styleTags);
  renderMusicEngineSnapshot(null, {
    progress: engineProgressState.music || 0,
    currentStage: "",
    stageKey: "",
    artifactDetail: ""
  });
  renderTags(videoTags, videoTagSet);
  renderStoryboard(shots);
  renderCameraList(shots);
  renderVideoEngineSnapshot(null, {
    progress: engineProgressState.video || 0,
    currentStage: "",
    stageKey: "",
    artifactDetail: ""
  });
  renderKaraEngineSnapshot(null, {
    progress: engineProgressState.kara || 0,
    currentStage: "",
    stageKey: "",
    artifactDetail: ""
  });
  renderTags(foryouTags, styleTags);
  renderDeliveryGovernancePulse();
  callWatchUiModule("renderSongSeedPreviewModule", state.songSeed);

  state.title = title;
  state.lines = lines;
  state.style = style;
  state.voice = voice;
}

function readSongSeedPayloadDataModule(payload) {
  return payload?.data || payload || {};
}

function setWatchLyricsSeedStatusModule(next = {}) {
  globalThis.watchLyricsSeedStatus = {
    phase: String(next?.phase || "").trim(),
    code: String(next?.code || "").trim(),
    type: String(next?.type || "").trim(),
    message: String(next?.message || "").trim(),
    status: Number(next?.status || 0) || 0,
    model: String(next?.model || "").trim(),
    envSource: String(next?.envSource || "").trim(),
    keyFingerprint: String(next?.keyFingerprint || "").trim(),
    fallbackReason: String(next?.fallbackReason || "").trim(),
    updatedAt: Date.now()
  };
  return globalThis.watchLyricsSeedStatus;
}

function buildWatchLyricsSeedStatusFromPayloadModule(payload, phase = "response") {
  const data = readSongSeedPayloadDataModule(payload);
  return setWatchLyricsSeedStatusModule({
    phase,
    code: String(data?.openai_error_code || payload?.openai_error_code || "").trim(),
    type: String(data?.openai_error_type || payload?.openai_error_type || "").trim(),
    message: String(data?.openai_error_message || payload?.openai_error_message || "").trim(),
    status: Number(data?.openai_error_status ?? payload?.openai_error_status ?? 0) || 0,
    model: String(data?.openai_model || payload?.openai_model || data?.model || payload?.model || "").trim(),
    envSource: String(data?.openai_env_source || payload?.openai_env_source || "").trim(),
    keyFingerprint: String(data?.openai_key_fingerprint || payload?.openai_key_fingerprint || "").trim(),
    fallbackReason: String(data?.fallback_reason || payload?.fallback_reason || "").trim()
  });
}

function summarizeWatchLyricsSeedStatusModule() {
  const status = globalThis.watchLyricsSeedStatus || {};
  if (String(status.phase || "").trim() === "pending") {
    return t("watch.subtitle.waitingLyricsSeed");
  }
  if (
    String(status.code || "").trim() === "request_timeout" ||
    Number(status.status || 0) === 408
  ) {
    return loginCopy(
      "Lyrics seed is taking longer than usual. Retrying quietly."
    );
  }
  const reason = [
    String(status.code || "").trim(),
    String(status.type || "").trim(),
    String(status.fallbackReason || "").trim()
  ].find(Boolean);
  if (!reason && !Number(status.status || 0)) return "";
  return [
    t("watch.subtitle.waitingLyricsSeed"),
    reason,
    Number(status.status || 0) ? String(Number(status.status || 0)) : "",
    String(status.model || "").trim(),
    String(status.envSource || "").trim(),
    String(status.keyFingerprint || "").trim() ? `key ${String(status.keyFingerprint || "").trim()}` : ""
  ].filter(Boolean).join(" · ");
}

globalThis.summarizeWatchLyricsSeedStatusModule = summarizeWatchLyricsSeedStatusModule;

async function runLyricsGenerateBridge(mode, options = {}) {
  const requestState = globalThis.lyricsSeedRequestState || (globalThis.lyricsSeedRequestState = {});
  const normalizedMode = String(mode || "music_video").trim();
  const inflight = globalThis.lyricsSeedRequestInflight || null;
  const inflightMode = String(requestState.mode || "").trim();
  if (
    inflight &&
    requestState.pending &&
    inflightMode === normalizedMode
  ) {
    console.info(
      "%c[lyrics-dedup] adopting in-flight lyrics request (mode=%s, age=%dms)",
      "color:#08f", normalizedMode, Date.now() - Number(requestState.startedAt || 0)
    );
    return inflight;
  }
  // CSSOS_PHASE2_LYRICS_BILLING_RACE 20260504 — Jing
  // "$0.02 的歌词输出成本，为何消耗那么多的钱？我今天早上刚刚充值了10美元，现在
  //  说完了。肯定是点击一次，输出 N 首歌词".
  //
  // ROOT CAUSE: this function only registered the in-flight lock at the
  // bottom (line was ~334, AFTER the billing call). Between line 154's
  // null-check and that registration, a second concurrent call would see
  // null and proceed to line 179 (`consumeBillableAction`) — burning
  // another $0.02 against the user's quota. Multi-entry universal-tap
  // (logo / mic / openMvPipelinePanel / submitVoiceFallback) all fire
  // within the same tick, so this race fires several times per click.
  //
  // FIX: register a deferred-resolve sentinel as the in-flight promise
  // BEFORE we touch billing. Subsequent overlapping calls now early-exit
  // at the dedup check above. Resolved/rejected at the same time as the
  // real requestPromise via the `__lyricsLockResolver` closure.
  let __lyricsLockResolver = null;
  const __lyricsLockPromise = new Promise((resolve) => { __lyricsLockResolver = resolve; });
  requestState.pending = true;
  requestState.startedAt = Date.now();
  requestState.mode = normalizedMode;
  globalThis.lyricsSeedRequestInflight = __lyricsLockPromise;
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const resolvedDurationSec = resolveCreationDurationValue();
  const normalizedDurationSec =
    Number.isFinite(Number(resolvedDurationSec)) && Number(resolvedDurationSec) > 0
      ? Number(resolvedDurationSec)
      : null;
  const resolvedWorkType = resolveCreationWorkTypeValue();
  const capability = enforceCreationCapability({
    mode,
    durationSec: normalizedDurationSec,
    workType: resolvedWorkType,
    allowCinemaBookingPrompt: false
  });
  if (!capability.ok) {
    requestState.pending = false;
    globalThis.lyricsSeedRequestInflight = null;
    __lyricsLockResolver?.({ ok: false, blocked: capability.reason, tier: capability.tier });
    return { ok: false, blocked: capability.reason, tier: capability.tier };
  }
  const billingAllowed = await consumeBillableAction("lyrics_generate", {
    meta: {
      mode,
      work_type: normalizeWorkTypeClient(resolvedWorkType || "single"),
      duration_sec: normalizedDurationSec
    }
  });
  if (!billingAllowed) {
    requestState.pending = false;
    globalThis.lyricsSeedRequestInflight = null;
    __lyricsLockResolver?.({ ok: false, blocked: "billing_gate", tier: capability.tier });
    return { ok: false, blocked: "billing_gate", tier: capability.tier };
  }
  songSeedVariationCounter += 1;
  const jobId = getMicJobId();
  const title = getSongSeedRequestTitle();
  const apply = options?.apply !== false;
  const titleLanguage = inferLanguageFromTitleText(title);
  // CSSMV_CIVILIZATION_CASCADE 20260424 #98 — UI locale wins over title
  // inference; no hardcoded "zh" fallback.
  const preferredLanguage =
    resolveCreationLanguageValue({ title }) ||
    globalThis.resolveUiPrimaryLanguageModule?.() ||
    titleLanguage ||
    document.documentElement.lang ||
    "en";
  const constraints = await buildSongSeedGenerationConstraints();
  const queuePriority = getMembershipPreset().queuePriority;
  const payload = {
    job_id: jobId,
    mode,
    transcript: micState.transcript || "",
    title,
    style: styleInput?.value?.trim() || state.style || "",
    voice: voiceInput?.value?.trim() || state.voice || "",
    language: preferredLanguage,
    // W360b — carry civilization from the person-MV seed so the backend can
    // authoritatively derive the mother-tongue lyric language (civToLanguageServer).
    // Without this, a Japanese-civilization person always got English lyrics.
    civilization: String(state.songSeed?.__civilization || "").trim() || null,
    variation_nonce: `${Date.now()}_${songSeedVariationCounter}_${mode}`,
    constraints,
    queue_priority: queuePriority,
    queue_lane: queuePriority
  };
  requestState.pending = true;
  requestState.startedAt = Date.now();
  requestState.mode = String(mode || "music_video");
  requestState.lastError = "";
  setWatchLyricsSeedStatusModule({ phase: "pending" });
  globalThis.setEngineStateModule?.("lyrics", "running");
  globalThis.setEngineDetailModule?.(
    "lyrics",
    t("watch.status.requestingLyricsSeed")
  );
  globalThis.syncWatchProgressRotatorModule?.();
  const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
  const timeoutMs = Math.max(15000, Number(options?.timeoutMs || 45000));
  const timeoutId =
    controller && typeof window !== "undefined"
      ? window.setTimeout(() => controller.abort(new Error("lyrics_seed_timeout")), timeoutMs)
      : 0;
  const requestPromise = (async () => {
    let res = null;
    let json = null;
    try {
      // CSSOS_PHASE2_WAND_TO_MV_LYRICS 20260429 #189 — Jing
      // /api/cssmv/song-seed was killed in #161; redirect to /api/mv/lyrics
      // and shape its response into the legacy song-seed envelope so the
      // rest of this function (status/applySongSeedToSettings) keeps working.
      const _lyricsBody = {
        prompt: payload.title || payload.transcript || "",
        style: payload.style || "",
        language: payload.language || "en",
        // CSSOS_WAVE_113I 20260511 — thread work_type + SECTION FORM
        // through so the backend prompts honor Advanced Settings.
        work_type: String(payload.work_type || payload.workType || "single"),
        section_form: String(payload.section_form || payload.sectionForm || ""),
        // CSSOS_WAVE_401 20260524 — Jing「人物母语歌词」: 此前硬编码 null, 人物文明
        // 从不传到歌词后端 → 雅典娜(古希腊)被写成英文。现在透传 civilization, 后端
        // 据此【权威路由】到人物母语(古希腊→el…), 真正交付母语歌词。
        civilization: payload.civilization || payload.civ || payload.personCiv || null,
        cultural_frame: payload.cultural_frame || null,
        voice: payload.voice || ""
      };
      res = await fetch("/api/mv/lyrics", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(_lyricsBody),
        signal: controller?.signal
      });
      const _lyricsJson = await res.json().catch(() => null);
      if (_lyricsJson && (_lyricsJson.lyrics || _lyricsJson.derived_settings)) {
        const _d = _lyricsJson.derived_settings || {};
        json = {
          ok: !!String(_lyricsJson.lyrics || "").trim(),
          empty: !String(_lyricsJson.lyrics || "").trim(),
          data: {
            title: String(_d.title || _lyricsJson.title || payload.title || "").trim(),
            lyrics: String(_lyricsJson.lyrics || "").trim(),
            lyrics_full: String(_lyricsJson.lyrics || "").trim(),
            musicStyle: String(_d.music_style || _d.genre || payload.style || "").trim(),
            music_style: String(_d.music_style || _d.genre || payload.style || "").trim(),
            videoOutline: String(_d.video_outline || "").trim(),
            sectionPrompts: Array.isArray(_d.section_scene_prompts)
              ? _d.section_scene_prompts
              : (Array.isArray(_lyricsJson.shot_scripts) ? _lyricsJson.shot_scripts : []),
            sectionBeats: Array.isArray(_d.section_beats) ? _d.section_beats : [],
            musicStructure: String(_d.music_structure || "").trim(),
            references: Array.isArray(_d.references) ? _d.references : [],
            workType: String(_d.work_type || "").trim(),
            derived_settings: _d,
            sections: Array.isArray(_lyricsJson.sections) ? _lyricsJson.sections : null,
            shot_scripts: Array.isArray(_lyricsJson.shot_scripts) ? _lyricsJson.shot_scripts : null
          }
        };
      } else {
        json = { ok: false, empty: true, data: null, error: "no_lyrics_in_response" };
      }
      if (!res?.ok) {
        requestState.lastError = `lyrics_seed_http_${res?.status || 0}`;
      } else if (!json?.ok || json?.empty || json?.no_data) {
        requestState.lastError = "lyrics_seed_empty";
      }
      buildWatchLyricsSeedStatusFromPayloadModule(
        json,
        json?.ok && !json?.empty && !json?.no_data ? "ready" : "error"
      );
      if (!json?.ok || json?.empty || json?.no_data) {
        globalThis.setEngineDetailModule?.(
          "lyrics",
          summarizeWatchLyricsSeedStatusModule() || t("watch.status.requestingLyricsSeed")
        );
      }
      if (apply && json?.ok && !json?.empty && !(globalThis.isSongSeedQuotaExceededModule?.(json) ?? false)) {
        applySongSeedToSettings(json.data || json);
      }
      return json;
    } catch (error) {
      requestState.lastError = /abort|timeout/i.test(String(error?.name || error?.message || error))
        ? "lyrics_seed_timeout"
        : String(error?.message || error || "lyrics_seed_failed");
      setWatchLyricsSeedStatusModule({
        phase: "error",
        code: /timeout/i.test(requestState.lastError) ? "request_timeout" : requestState.lastError,
        type: /timeout/i.test(requestState.lastError) ? "timeout" : "",
        status: /timeout/i.test(requestState.lastError) ? 408 : 0
      });
      globalThis.setEngineDetailModule?.(
        "lyrics",
        summarizeWatchLyricsSeedStatusModule() || t("watch.status.retryingLyricsRequest")
      );
      globalThis.setEngineStateModule?.("lyrics", "running");
      globalThis.setEngineDetailModule?.(
        "lyrics",
        /timeout/i.test(requestState.lastError)
          ? t("watch.status.retryingLyricsSlow")
          : t("watch.status.retryingLyricsRequest")
      );
      throw error;
    } finally {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      requestState.pending = false;
      globalThis.lyricsSeedRequestInflight = null;
      globalThis.syncWatchProgressRotatorModule?.();
    }
  })();
  // CSSOS_PHASE2_LYRICS_BILLING_RACE 20260504 — settle the early-lock
  // promise with the same outcome as the real request. Anyone who
  // adopted __lyricsLockPromise at the dedup check above gets the real
  // result, no extra billing burned.
  requestPromise.then(
    (value) => __lyricsLockResolver?.(value),
    (err) => __lyricsLockResolver?.(Promise.reject(err))
  );
  globalThis.lyricsSeedRequestInflight = requestPromise;
  return requestPromise;
}

function setHintKeyBridge(key) {
  const el = document.getElementById("profile-hint");
  if (!el) return;
  if (!key) {
    el.textContent = "";
    return;
  }
  try {
    el.textContent = t(key);
  } catch {
    el.textContent = key;
  }
}

function passkeySupportedBridge() {
  return !!(window.PublicKeyCredential && navigator.credentials);
}

function b64urlToBufBridge(s) {
  const n = String(s || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = n.length % 4 ? "=".repeat(4 - (n.length % 4)) : "";
  const str = atob(n + pad);
  const buf = new Uint8Array(str.length);
  for (let i = 0; i < str.length; i += 1) buf[i] = str.charCodeAt(i);
  return buf.buffer;
}

function bufToB64urlBridge(buf) {
  const bytes = new Uint8Array(buf);
  let str = "";
  for (let i = 0; i < bytes.length; i += 1) str += String.fromCharCode(bytes[i]);
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function normalizePublicKeyOptionsBridge(pk) {
  const out = JSON.parse(JSON.stringify(pk || {}));
  if (out.challenge) out.challenge = b64urlToBufBridge(out.challenge);
  if (out.user && out.user.id) out.user.id = b64urlToBufBridge(out.user.id);
  if (Array.isArray(out.excludeCredentials)) {
    out.excludeCredentials = out.excludeCredentials.map((c) => ({ ...c, id: b64urlToBufBridge(c.id) }));
  }
  if (Array.isArray(out.allowCredentials)) {
    out.allowCredentials = out.allowCredentials.map((c) => ({ ...c, id: b64urlToBufBridge(c.id) }));
  }
  return out;
}

function credentialToJSONBridge(cred) {
  const res = {
    id: cred.id,
    rawId: bufToB64urlBridge(cred.rawId),
    type: cred.type,
    response: {}
  };
  const r = cred.response;
  if (r) {
    if (r.attestationObject) res.response.attestationObject = bufToB64urlBridge(r.attestationObject);
    if (r.clientDataJSON) res.response.clientDataJSON = bufToB64urlBridge(r.clientDataJSON);
    if (r.authenticatorData) res.response.authenticatorData = bufToB64urlBridge(r.authenticatorData);
    if (r.signature) res.response.signature = bufToB64urlBridge(r.signature);
    if (r.userHandle) res.response.userHandle = bufToB64urlBridge(r.userHandle);
  }
  return res;
}

async function passkeyEnableBridge() {
  if (!passkeySupportedBridge()) {
    setHintKeyBridge("passkey.unsupported");
    return;
  }
  setHintKeyBridge("");
  const optRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/register/options`, {
    headers: { accept: "application/json" }
  });
  if (!optRes.ok) {
    setHintKeyBridge("passkey.register_options_failed");
    return;
  }
  const optJson = await optRes.json();
  const publicKey = normalizePublicKeyOptionsBridge(
    optJson?.data?.publicKey || optJson?.publicKey || optJson
  );
  const cred = await navigator.credentials.create({ publicKey });
  const body = { credential: credentialToJSONBridge(cred) };
  const verRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/register/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!verRes.ok) {
    setHintKeyBridge("passkey.register_verify_failed");
    return;
  }
  setHintKeyBridge("passkey.enabled");
}

async function passkeyLoginBridge() {
  if (!passkeySupportedBridge()) {
    setHintKeyBridge("passkey.unsupported");
    return;
  }
  setHintKeyBridge("");
  const optRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/login/options`, {
    headers: { accept: "application/json" }
  });
  if (!optRes.ok) {
    setHintKeyBridge("passkey.login_options_failed");
    return;
  }
  const optJson = await optRes.json();
  if (optJson?.data?.empty) {
    setHintKeyBridge("passkey.not_enabled");
    return;
  }
  const publicKey = normalizePublicKeyOptionsBridge(
    optJson?.data?.publicKey || optJson?.publicKey || optJson
  );
  const cred = await navigator.credentials.get({ publicKey });
  const body = { credential: credentialToJSONBridge(cred) };
  const verRes = await fetch(`${PASSKEY_BASE}/api/auth/passkey/login/verify`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  if (!verRes.ok) {
    setHintKeyBridge("passkey.login_verify_failed");
    return;
  }
  setHintKeyBridge("passkey.enabled");
}

function apiBaseBridge() {
  const v =
    window.CSS_API_BASE ||
    window.CSS_BASE_URL ||
    (location.origin.includes("localhost") ? "http://127.0.0.1:8081" : location.origin);
  return String(v).replace(/\/+$/, "");
}

function resolvePublicAssetUrlBridge(path) {
  const normalizedPath = String(path || "").replace(/^\/+/, "");
  if (!normalizedPath) return "";
  try {
    return new URL(normalizedPath, window.location.href).toString();
  } catch (_error) {
    return `./${normalizedPath}`;
  }
}

async function createRunBridge({ title, uiLang, tier, voice, lyricsText = "", jobId = "" }) {
  const baseUrl = apiBaseBridge();
  const resolvedWorkType = resolveCreationWorkTypeValue({ title, lyricsText });
  const resolvedTempo = resolveCreationTempoValue({ title, lyricsText });
  const resolvedKey = resolveCreationKeyValue({ title, lyricsText });
  const resolvedDuration = resolveCreationDurationValue({ title, lyricsText });
  // CSSMV_CIVILIZATION_CASCADE 20260424 #98 — UI locale, not hardcoded "zh".
  const generationLang =
    resolveCreationLanguageValue({ title }) ||
    globalThis.resolveUiPrimaryLanguageModule?.() ||
    uiLang ||
    "en";
  const selectedLanguages = globalThis.getSelectedCreationLanguages?.() || [generationLang];
  const selectedVoiceTracks = globalThis.getSelectedCreationVoiceTracks?.() || ["lead_default"];
  // CSSOS_WAVE_415 20260524 — Jing「一键MV等万能入口也按高级设置的偏好出多语言」:
  // stash the chosen languages so the freshly-created work's 🌐 pill fires the
  // paid extra tracks (mother-tongue/1st stays free). This is the UNIVERSAL hook
  // for every entry that funnels through here (incl. zero-input logo/mic/play).
  // Do NOT clobber a stash that the Person-MV panel just set (mother tongue must
  // win there) — respect any stash younger than 30s.
  try {
    const _existing = globalThis.__cssosPendingLangTracks;
    const _fresh = _existing && _existing.ts && (Date.now() - _existing.ts) < 30000;
    if (!_fresh && Array.isArray(selectedLanguages) && selectedLanguages.length > 1) {
      globalThis.__cssosPendingLangTracks = { languages: selectedLanguages.slice(), ts: Date.now() };
    }
  } catch (_e) {}
  const lyricDrafts =
    creationState.lyricDrafts && typeof creationState.lyricDrafts === "object"
      ? Object.fromEntries(
          Object.entries(creationState.lyricDrafts).map(([lang, text]) => [
            String(lang || "").trim().toLowerCase(),
            String(text || "")
          ])
        )
      : {};
  const preset = getMembershipPreset(tier);
  const selectionCounts = getCreationSelectionCounts();
  const micBehavior = readPanelBehaviorSettingsLocal().mic || {
    longpress_ms: LONGPRESS_MS,
    max_hold_sec: Math.round(HOLD_MAX_MS / 1000)
  };
  const normalizedLyricsText = String(lyricsText || "").trim();
  const normalizedDuration =
    Number.isFinite(Number(resolvedDuration)) && Number(resolvedDuration) > 0
      ? Number(resolvedDuration)
      : null;
  const lyricLines = normalizedLyricsText
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .slice(0, 120);
  const builtInWestworldReferenceMedia = (() => {
    const haystack = [
      title,
      creationState.prompt,
      creationState.inspirationNotes,
      state.songSeed?.title,
      state.songSeed?.videoOutline,
      state.songSeed?.video_outline
    ]
      .map((value) => String(value || "").toLowerCase())
      .join(" ");
    if (!/westworld|西部世界/.test(haystack)) return [];
    return [
      "/srv/cssos/repo/public/examples/Back-to-the-Westworld-12_Media_QltXwpK6l4k_002_720p.mp4",
      "/srv/cssos/repo/public/examples/Back-to-the-Westworld-12_Media_QltXwpK6l4k_002_720p (1).mp4"
    ];
  })();
  const referenceMediaPaths = [
    ...(Array.isArray(state.songSeed?.references) ? state.songSeed.references : []),
    ...(Array.isArray(state.songSeed?.localReferenceMediaPaths)
      ? state.songSeed.localReferenceMediaPaths
      : []),
    ...builtInWestworldReferenceMedia
  ]
    .map((value) => String(value || "").trim())
    .filter(Boolean)
    .filter((value) => {
      if (value.startsWith("/")) return true;
      return /^\/?srv\/cssos\/repo\/public\/examples\//i.test(value);
    })
    .filter((value, index, list) => list.indexOf(value) === index);
  const structurePlan = normalizeStructurePlanClient(state.songSeed?.structurePlan);
  const structureTree = Array.isArray(state.songSeed?.structureTree) ? state.songSeed.structureTree : [];
  const engineDefaults =
    (globalThis.creationEngineDefaults && typeof globalThis.creationEngineDefaults === "object"
      ? globalThis.creationEngineDefaults
      : {}) || {};
  const creativePayload = {
    work_type: normalizeWorkTypeClient(resolvedWorkType),
    ...(structurePlan ? { structure_plan: structurePlan } : {}),
    ...(structureTree.length ? { structure_tree: structureTree } : {}),
    genre: creationState.selections.genre || "",
    mood: creationState.selections.mood || "",
    instrument: creationState.selections.instrument || "",
    instrumentation: creationState.instrumentation || "",
    ambience: creationState.selections.ambience || "",
    vocal_gender: creationState.selections.vocalGender || "",
    vocal_style: creationState.vocalStyle || "",
    ensemble_style: creationState.ensembleStyle || "",
    arrangement_density: Number(creationState.arrangementDensity || 0.6),
    dynamics_curve: creationState.dynamicsCurve || "",
    section_form: creationState.sectionForm || "",
    articulation_bias: creationState.articulationBias || "",
    voicing_register: creationState.voicingRegister || "",
    percussion_activity: Number(creationState.percussionActivity || 0.45),
    expression_cc_bias: creationState.expressionCcBias || "",
    humanization: Number(creationState.humanization || 0.35),
    inspiration_notes: String(creationState.inspirationNotes || "").slice(0, 1000),
    licensed_style_pack: creationState.licensedStylePack || "",
    external_audio_adapter: creationState.externalAudioAdapter || "",
    tempo_bpm: Number(resolvedTempo || 88),
    musical_key: resolvedKey || "C",
    subtitle_track_languages: selectedLanguages,
    voice_tracks: selectedVoiceTracks,
    lyric_versions: lyricDrafts,
    prompt: String(normalizedLyricsText || creationState.prompt || "").slice(0, 2400)
  };
  if (normalizedDuration) {
    creativePayload.duration_s = normalizedDuration;
  }
  const body = {
    cssl: title,
    ui_lang: generationLang,
    tier: tier || "dev",
    commands: {
      voice: {
        ...(voice || { bytes: 0, mime: "audio/webm", mode: "single" }),
        job_id: String(jobId || voice?.job_id || "").trim()
      },
      voice_capture: {
        wake_spell: String(state.spell || DEFAULT_SPELL),
        longpress_ms: Number(micBehavior.longpress_ms || LONGPRESS_MS),
        capture_max_sec: Number(micBehavior.max_hold_sec || Math.round(HOLD_MAX_MS / 1000))
      },
      lyrics: {
        detected_lang: generationLang,
        primary_lang: generationLang,
        additional_languages: selectedLanguages.filter((lang) => lang !== generationLang),
        track_languages: selectedLanguages,
        lyric_drafts: lyricDrafts,
        text: normalizedLyricsText,
        lines: lyricLines
      },
      engine: {
        lyrics: String(engineDefaults.lyrics || "cssmv"),
        cover: String(engineDefaults.cover || "cssmv"),
        music: String(engineDefaults.music || "cssmv"),
        video: String(engineDefaults.video || "cssmv"),
        mv: String(engineDefaults.mv || "cssmv")
      },
      video: {
        ...(normalizedDuration ? { duration_s: normalizedDuration } : {}),
        ...(referenceMediaPaths.length ? { reference_media_paths: referenceMediaPaths } : {})
      },
      capability: {
        membership_tier: normalizeAccessTier(tier),
        monthly_generation_limit: preset.monthlyGenerationLimit,
        max_duration_sec: preset.maxDurationSec,
        max_resolution: preset.maxResolution,
        watermark: preset.watermark,
        included_languages: preset.maxIncludedLanguages,
        included_voice_lanes: preset.maxIncludedVoiceLanes,
        selected_languages: selectionCounts.languageCount,
        selected_voice_lanes: selectionCounts.voiceLaneCount
      },
      queue: {
        lane: preset.queuePriority,
        priority: preset.queuePriority,
        membership_tier: normalizeAccessTier(tier)
      },
      creative: creativePayload
    }
  };
  globalThis.setWatchCreateRunDebugMeta?.("request", {
    endpoint: `${baseUrl}/cssapi/v1/runs`,
    title: String(title || "").trim().slice(0, 120),
    hasLyrics: normalizedLyricsText ? "true" : "false",
    lyricLines: String(lyricLines.length || 0),
    jobId: String(jobId || "").trim()
  });
  const res = await fetch(`${baseUrl}/cssapi/v1/runs`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text().catch(() => "");
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_err) {
    parsed = null;
  }
  if (!res.ok) {
    globalThis.setWatchCreateRunDebugMeta?.("response", {
      status: String(res.status || 0),
      note: text.slice(0, 180)
    });
    currentWatchAudioRunError = `http_${res.status}`;
    updateWatchAudioDebug();
    throw new Error(`http=${res.status} ${text}`);
  }
  const statusUrl = String(parsed?.status_url || parsed?.data?.status_url || "").trim();
  const inferredRunId =
    String(parsed?.run_id || parsed?.data?.run_id || "").trim() ||
    (statusUrl.match(/\/cssapi\/v1\/runs\/([^/]+)\/status/i)?.[1] || "").trim() ||
    (text.match(/"run_id"\s*:\s*"([^"]+)"/i)?.[1] || "").trim();
  if (inferredRunId) {
    globalThis.setWatchCreateRunDebugMeta?.("response", {
      status: String(res.status || 0),
      runId: inferredRunId,
      statusUrl: statusUrl || `/cssapi/v1/runs/${encodeURIComponent(inferredRunId)}/status`,
      note: parsed?.schema || "accepted"
    });
    currentWatchAudioRunId = inferredRunId;
    currentWatchAudioRunError = "";
    updateWatchAudioDebug();
    return {
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      run_id: inferredRunId,
      status_url: statusUrl || `/cssapi/v1/runs/${encodeURIComponent(inferredRunId)}/status`
    };
  }
  globalThis.setWatchCreateRunDebugMeta?.("response", {
    status: String(res.status || 0),
    note: "no_run_id"
  });
  currentWatchAudioRunError = `http_${res.status}_no_run_id`;
  updateWatchAudioDebug();
  return parsed && typeof parsed === "object" ? parsed : {};
}

async function createZeroInputMvBridge({ uiLang, tier } = {}) {
  const baseUrl = apiBaseBridge();
  // CSSMV_UI_LANG_AUTO_EMPTY 20260423 #86 — Jing: UI locale is the primary
  // fallback for random/default language, not hardcoded "zh".
  const uiFallback = (typeof globalThis !== "undefined" && globalThis.resolveUiPrimaryLanguageModule)
    ? globalThis.resolveUiPrimaryLanguageModule()
    : "en";
  const generationLang = String(uiLang || window.CSS_UI_LANG || document.documentElement.lang || creationState.language || uiFallback).trim() || uiFallback || "en";
  const engineDefaults =
    (globalThis.creationEngineDefaults && typeof globalThis.creationEngineDefaults === "object"
      ? globalThis.creationEngineDefaults
      : {}) || {};
  const body = {
    engine: {
      name: "cssmv",
      version: "v1"
    },
    engine_defaults: {
      lyrics: String(engineDefaults.lyrics || "cssmv"),
      cover: String(engineDefaults.cover || "cssmv"),
      music: String(engineDefaults.music || "cssmv"),
      video: String(engineDefaults.video || "cssmv"),
      mv: String(engineDefaults.mv || "cssmv")
    },
    input: {
      type: "click"
    },
    creative: {},
    versions: {
      primary_lang: generationLang,
      langs: [generationLang],
      voices: ["female"],
      outputs: ["karaoke_mv"]
    }
  };
  const res = await fetch(`${baseUrl}/cssapi/v1/mv`, {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(body)
  });
  const text = await res.text().catch(() => "");
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch (_err) {
    parsed = null;
  }
  if (!res.ok) {
    currentWatchAudioRunError = `http_${res.status}`;
    updateWatchAudioDebug();
    throw new Error(`http=${res.status} ${text}`);
  }
  const inferredRunId = String(parsed?.run_id || parsed?.data?.run_id || "").trim();
  if (inferredRunId) {
    currentWatchAudioRunId = inferredRunId;
    currentWatchAudioRunError = "";
    updateWatchAudioDebug();
    return {
      ...(parsed && typeof parsed === "object" ? parsed : {}),
      run_id: inferredRunId,
      tier: tier || "dev"
    };
  }
  currentWatchAudioRunError = `http_${res.status}_no_run_id`;
  updateWatchAudioDebug();
  return parsed && typeof parsed === "object" ? parsed : {};
}

Object.assign(globalThis, {
  updateEnginePanelsBridge,
  runLyricsGenerateBridge,
  setHintKeyBridge,
  passkeySupportedBridge,
  b64urlToBufBridge,
  bufToB64urlBridge,
  normalizePublicKeyOptionsBridge,
  credentialToJSONBridge,
  passkeyEnableBridge,
  passkeyLoginBridge,
  apiBaseBridge,
  resolvePublicAssetUrlBridge,
  createRunBridge,
  createZeroInputMvBridge
});
