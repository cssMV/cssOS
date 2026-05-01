const micState = {
  jobId: null,
  transcript: "",
  lang: "en",
  lastCaptureMs: 0,
  debug: null,
  capturePhase: "idle",
  captureMessage: "",
  captureDetail: "",
  lastAudioUrl: "",
  lastAudioSize: 0,
  rawVoiceId: null,
  rawVoiceDeleted: false,
  creationSource: "manual",
  captureVisibleUntil: 0
};

let micRecorder = null;
let micChunks = [];
let micStream = null;
let micRecording = false;
let micDiscardOnStop = false;
let micCaptureHideTimer = null;
const micHoldState = globalThis.__cssosMicHold || (globalThis.__cssosMicHold = {
  active: false,
  startedAt: 0,
  raf: 0,
  timeout: 0,
  startTimer: 0,
  pointerId: null,
  lastCommittedAt: 0,
  suppressClickUntil: 0
});
const getHoldMaxMs = () => Number(globalThis.HOLD_MAX_MS || window.CSS_HOLD_MAX_MS || 30000);

function ringEl() {
  return document.getElementById("hold-ring");
}

function ringFg() {
  const r = ringEl();
  if (!r) return null;
  return r.querySelector(".hold-ring-fg");
}

function setRingProgress01(p) {
  const fg = ringFg();
  if (!fg) return;
  const C = 289;
  const clamped = Math.max(0, Math.min(1, p));
  fg.style.strokeDashoffset = String(C * (1 - clamped));
}

function showRing(on) {
  const r = ringEl();
  if (!r) return;
  if (on) r.classList.add("is-on");
  else r.classList.remove("is-on");
}

const getMicJobId = () => {
  if (!micState.jobId) {
    micState.jobId = typeof crypto !== "undefined" && crypto.randomUUID
      ? crypto.randomUUID()
      : `job_${Date.now()}`;
  }
  return micState.jobId;
};

function buildMicCaptureDebugSnapshot(micSettings = readPanelBehaviorSettingsLocal().mic || {}) {
  const maxSec = Math.max(3, Number(micSettings?.max_hold_sec || 30));
  const captureSec = Math.max(0.6, Math.min(maxSec, Number(micState.lastCaptureMs || 0) / 1000 || maxSec));
  const wakeDetected = !!micState.debug?.wakeDetected;
  const hitSec = wakeDetected
    ? Math.min(Math.max(captureSec * 0.38, 0.6), Math.max(0.7, captureSec - 0.5))
    : 0;
  const preSec = wakeDetected ? hitSec : captureSec;
  const postSec = wakeDetected ? Math.max(0, captureSec - hitSec) : 0;
  const transcript = String(micState.debug?.transcript || micState.transcript || "").trim();
  const finalTitle = String(micState.debug?.finalTitle || "").trim() || loginCopy("Direct generation fallback");
  const total = Math.max(captureSec, 0.001);
  const hitPercent = wakeDetected ? Math.max(6, Math.min(94, (hitSec / total) * 100)) : 50;
  return {
    prePercent: wakeDetected ? Math.max(8, Math.min(88, (preSec / total) * 100)) : 100,
    postPercent: wakeDetected ? Math.max(0, Math.min(92, (postSec / total) * 100)) : 0,
    hitPercent,
    preLabel: `${preSec.toFixed(1)}s`,
    hitLabel: wakeDetected ? `${hitSec.toFixed(1)}s` : loginCopy("none"),
    postLabel: `${postSec.toFixed(1)}s`,
    transcriptLabel: transcript
      ? loginCopy(`Transcript: ${transcript.slice(0, 96)}`)
      : loginCopy("Transcript: waiting for a new capture"),
    finalTitle
  };
}

function buildMicDebugBoardMarkup(micSettings = readPanelBehaviorSettingsLocal().mic || {}) {
  const micDebug = buildMicCaptureDebugSnapshot(micSettings);
  return `
    <div class="mic-debug-board" data-mic-debug-board>
      <div class="mic-debug-title">${escapeHtml(loginCopy("Wake Window Preview"))}</div>
      <div class="mic-debug-timeline">
        <span class="mic-debug-segment is-pre" style="width:${escapeHtml(String(micDebug.prePercent))}%"></span>
        <span class="mic-debug-hit" style="left:${escapeHtml(String(micDebug.hitPercent))}%"></span>
        <span class="mic-debug-segment is-post" style="width:${escapeHtml(String(micDebug.postPercent))}%"></span>
      </div>
      <div class="mic-debug-meta">
        <span>${escapeHtml(loginCopy(`Pre ${micDebug.preLabel}`))}</span>
        <span>${escapeHtml(loginCopy(`Hit ${micDebug.hitLabel}`))}</span>
        <span>${escapeHtml(loginCopy(`Post ${micDebug.postLabel}`))}</span>
      </div>
      <div class="mic-debug-transcript">${escapeHtml(micDebug.transcriptLabel)}</div>
      <div class="mic-debug-title-result">${escapeHtml(loginCopy(`Final title: ${micDebug.finalTitle}`))}</div>
    </div>
  `;
}

function revokeMicCaptureAudioUrl() {
  if (!micState.lastAudioUrl) return;
  try {
    URL.revokeObjectURL(micState.lastAudioUrl);
  } catch {
    // ignore
  }
  micState.lastAudioUrl = "";
}

function deleteRawVoiceCapture(options = {}) {
  revokeMicCaptureAudioUrl();
  micState.lastAudioSize = 0;
  micState.rawVoiceId = null;
  micState.rawVoiceDeleted = true;
  if (!options.preserveTranscript) {
    micState.transcript = "";
    if (micState.debug && typeof micState.debug === "object") {
      micState.debug = {
        ...micState.debug,
        transcript: "",
        transcriptSegments: []
      };
    }
  }
  if (state.songSeed?.draft?.source === "voice") {
    state.songSeed = {
      ...(state.songSeed || {}),
      draft: {
        ...(state.songSeed?.draft || {}),
        rawVoiceId: null,
        rawVoiceDeleted: true
      }
    };
  }
  renderMicCaptureStatus();
}

function renderMicCaptureStatus() {
  if (!micCaptureStatus || !micCaptureKicker || !micCaptureTitle || !micCaptureMeta) return;
  const phase = String(micState.capturePhase || "idle").trim() || "idle";
  const title =
    String(micState.captureMessage || "").trim() ||
    loginCopy("Ready");
  const meta =
    String(micState.captureDetail || "").trim() ||
    loginCopy(
      "Tap the mirror/mic to reuse lyric magic, or hold to capture a voice clip."
    );
  micCaptureStatus.dataset.phase = phase;
  const debugEnabled =
    typeof location !== "undefined" && /(?:\?|&)micdebug=1(?:&|$)/i.test(location.search || "");
  if (!debugEnabled) {
    micCaptureStatus.hidden = true;
    renderWatchMicCaptureCard();
    return;
  }
  micCaptureKicker.textContent = loginCopy("Mic status");
  micCaptureTitle.textContent = title;
  micCaptureMeta.textContent = meta;
  const transcriptSegments = Array.isArray(micState.debug?.transcriptSegments) ? micState.debug.transcriptSegments : [];
  const titleCandidates = Array.isArray(micState.debug?.titleCandidates) ? micState.debug.titleCandidates : [];
  if (micCaptureTranscriptSegments instanceof HTMLElement) {
    micCaptureTranscriptSegments.hidden = !transcriptSegments.length;
    micCaptureTranscriptSegments.textContent = transcriptSegments.length
      ? loginCopy(
          `Transcript segments: ${transcriptSegments.join(" | ")}`
        )
      : "";
  }
  if (micCaptureTitleCandidates instanceof HTMLElement) {
    micCaptureTitleCandidates.hidden = !titleCandidates.length;
    micCaptureTitleCandidates.textContent = titleCandidates.length
      ? loginCopy(
          `Title candidates: ${titleCandidates.map((item) => `${item.label}=${item.value}`).join(" | ")}`
        )
      : "";
  }
  if (micCaptureAudio instanceof HTMLAudioElement) {
    const allowRawAudioPlayback = !["demo-audio", "final-artifact"].includes(String(currentWatchAudioSourceKind || ""));
    const hasAudio = !!micState.lastAudioUrl && allowRawAudioPlayback;
    micCaptureAudio.hidden = !hasAudio;
    if (hasAudio && micCaptureAudio.src !== micState.lastAudioUrl) {
      micCaptureAudio.src = micState.lastAudioUrl;
      micCaptureAudio.load();
    }
    if (!hasAudio && micCaptureAudio.getAttribute("src")) {
      micCaptureAudio.pause?.();
      micCaptureAudio.removeAttribute("src");
      micCaptureAudio.load();
    }
  }
  const activePhases = new Set(["holding", "requesting", "recording", "casting", "transcribing"]);
  const pinnedVisible = Number(micState.captureVisibleUntil || 0) > Date.now();
  micCaptureStatus.hidden = !(activePhases.has(phase) || pinnedVisible);
  renderWatchMicCaptureCard();
}

function renderWatchMicCaptureCard() {
  if (!(watchMicCaptureCard instanceof HTMLElement)) return;
  const transcript = String(micState.debug?.transcript || micState.transcript || "").trim();
  const finalTitle = String(micState.debug?.finalTitle || state.title || "").trim();
  const allowRawAudioPlayback = !["demo-audio", "final-artifact"].includes(String(currentWatchAudioSourceKind || ""));
  const hasAudio = !!micState.lastAudioUrl && allowRawAudioPlayback;
  const rawVoiceId = String(micState.rawVoiceId || state.songSeed?.draft?.rawVoiceId || "").trim();
  const voiceDerivedTitle = String(state.songSeed?.draft?.source || micState.creationSource || "").trim() === "voice";
  const phase = String(micState.capturePhase || "idle").trim() || "idle";
  watchMicCaptureCard.dataset.phase = phase;
  if (!hasAudio && !transcript && !finalTitle) {
    watchMicCaptureCard.innerHTML = `
      <div class="watch-info-kicker">${escapeHtml(loginCopy("Last raw voice capture"))}</div>
      <div class="watch-activity-empty">${escapeHtml(loginCopy("No voice clip captured in this session yet."))}</div>
    `;
    return;
  }
  watchMicCaptureCard.innerHTML = `
    <div class="watch-info-kicker">${escapeHtml(loginCopy("Last raw voice capture"))}</div>
    <div class="work-extra">${escapeHtml(loginCopy(`Status: ${micState.captureMessage || "Ready"}`))}</div>
    <div class="work-extra">${escapeHtml(micState.captureDetail || loginCopy("This panel mirrors the logo capture result for debugging and confirmation."))}</div>
    ${voiceDerivedTitle ? `<div class="work-extra">${escapeHtml(loginCopy("Title source: voice-derived"))}</div>` : ""}
    ${transcript ? `<div class="work-extra">${escapeHtml(loginCopy(`Transcript: ${transcript}`))}</div>` : ""}
    ${finalTitle ? `<div class="work-extra">${escapeHtml(loginCopy(`Final title: ${finalTitle}`))}</div>` : ""}
    <div class="watch-mic-capture-actions">
      <button class="mini-btn ghost tiny" type="button" data-watch-mic-copy="transcript" ${transcript ? "" : "disabled"}>${escapeHtml(loginCopy("Copy transcript"))}</button>
      <button class="mini-btn ghost tiny" type="button" data-watch-mic-copy="title" ${finalTitle ? "" : "disabled"}>${escapeHtml(loginCopy("Copy final title"))}</button>
      <button class="mini-btn ghost tiny" type="button" data-watch-mic-clear>${escapeHtml(loginCopy("Clear cache"))}</button>
      <button class="mini-btn ghost tiny" type="button" data-watch-mic-delete-raw ${(hasAudio || rawVoiceId || transcript) ? "" : "disabled"}>${escapeHtml(loginCopy("Delete raw voice"))}</button>
    </div>
    ${hasAudio ? `<audio class="mic-capture-audio" controls preload="metadata" src="${escapeHtml(micState.lastAudioUrl)}"></audio>` : ""}
    ${!hasAudio && micState.lastAudioUrl ? `<div class="work-extra">${escapeHtml(loginCopy("Raw capture is hidden while demo/final music is playing, so fallback playback stays clean."))}</div>` : ""}
    ${micState.rawVoiceDeleted ? `<div class="work-extra">${escapeHtml(loginCopy("Raw voice removed. The work and derived title stay available."))}</div>` : ""}
  `;
  watchMicCaptureCard.querySelector('[data-watch-mic-copy="transcript"]')?.addEventListener("click", () => {
    void copyMicCaptureField("transcript");
  });
  watchMicCaptureCard.querySelector('[data-watch-mic-copy="title"]')?.addEventListener("click", () => {
    void copyMicCaptureField("title");
  });
  watchMicCaptureCard.querySelector("[data-watch-mic-clear]")?.addEventListener("click", () => {
    clearMicCaptureCache();
  });
  watchMicCaptureCard.querySelector("[data-watch-mic-delete-raw]")?.addEventListener("click", () => {
    deleteRawVoiceCapture({ preserveTranscript: true });
    showToast(loginCopy("Raw voice deleted. The work stays intact."));
  });
}

async function copyMicCaptureField(field = "transcript") {
  const normalized = String(field || "transcript").trim().toLowerCase();
  const value =
    normalized === "title"
      ? String(micState.debug?.finalTitle || state.title || "").trim()
      : String(micState.debug?.transcript || micState.transcript || "").trim();
  if (!value) return false;
  try {
    await navigator.clipboard.writeText(value);
    showToast(
      normalized === "title"
        ? loginCopy("Final title copied.")
        : loginCopy("Transcript copied.")
    );
    return true;
  } catch (_err) {
    showToast(loginCopy("Copy failed on this device."));
    return false;
  }
}

function clearMicCaptureCache() {
  deleteRawVoiceCapture();
  micState.transcript = "";
  micState.lastCaptureMs = 0;
  micState.capturePhase = "idle";
  micState.captureMessage = "";
  micState.captureDetail = "";
  micState.debug = null;
  micState.rawVoiceDeleted = false;
  micState.creationSource = "manual";
  renderMicCaptureStatus();
  showToast(loginCopy("Voice capture cache cleared."));
}

function pulseLogoForMic(mode = "listening", durationMs = 900) {
  if (!logoPanel) return;
  const nextMode = String(mode || "listening").trim() || "listening";
  const singleMode = getStoredMirrorAnimationPerType()?.single || getStoredMirrorAnimationMode() || MIRROR_ANIMATION_MODES.HALO;
  micForcedMirrorAnimationMode = Object.values(MIRROR_ANIMATION_MODES).includes(singleMode)
    ? singleMode
    : MIRROR_ANIMATION_MODES.HALO;
  if (nextMode === "recording" || nextMode === "processing") {
    enterLyricSpellcast();
    applyMirrorAnimationMode(micForcedMirrorAnimationMode);
    return;
  }
  enterLyricSpellcast();
  applyMirrorAnimationMode(micForcedMirrorAnimationMode);
  window.setTimeout(() => {
    if (!micHoldState.active && !micRecState.started) exitLyricSpellcast();
  }, Math.max(260, Number(durationMs || 900)));
}

function stopLogoMicPulse() {
  if (!logoPanel) return;
  micForcedMirrorAnimationMode = "";
  exitLyricSpellcast(true);
}

function clearMicCaptureHideTimer() {
  if (!micCaptureHideTimer) return;
  clearTimeout(micCaptureHideTimer);
  micCaptureHideTimer = null;
}

function scheduleMicCaptureStatusHide(delayMs = 10000) {
  clearMicCaptureHideTimer();
  const delay = Math.max(0, Number(delayMs || 0));
  micState.captureVisibleUntil = Date.now() + delay;
  micCaptureHideTimer = setTimeout(() => {
    micCaptureHideTimer = null;
    micState.captureVisibleUntil = 0;
    renderMicCaptureStatus();
  }, delay);
}

function setMicCaptureStatus(phase, message, detail = "") {
  micState.capturePhase = String(phase || "idle").trim() || "idle";
  micState.captureMessage = String(message || "").trim();
  micState.captureDetail = String(detail || "").trim();
  const ongoingPhases = new Set([
    "holding",
    "requesting",
    "recording",
    "casting",
    "transcribing",
    "recognized",
    "transcribed",
    "fallback",
    "submitting"
  ]);
  const recordingPhases = new Set(["requesting", "recording"]);
  const transientVisiblePhases = new Set([
    "recognized",
    "transcribed",
    "fallback",
    "submitting",
    "permission_denied",
    "error",
    "transcribe_failed"
  ]);
  if (ongoingPhases.has(micState.capturePhase)) {
    pulseLogoForMic(recordingPhases.has(micState.capturePhase) ? "recording" : "processing");
  } else if (!micHoldState.active && !micRecState.started) {
    stopLogoMicPulse();
  }
  if (recordingPhases.has(micState.capturePhase) || micState.capturePhase === "holding" || micState.capturePhase === "casting" || micState.capturePhase === "transcribing") {
    clearMicCaptureHideTimer();
    micState.captureVisibleUntil = 0;
  } else if (transientVisiblePhases.has(micState.capturePhase)) {
    scheduleMicCaptureStatusHide(10000);
  } else if (["idle", "ready"].includes(micState.capturePhase)) {
    clearMicCaptureHideTimer();
    micState.captureVisibleUntil = 0;
  }
  renderMicCaptureStatus();
}

async function startMicRecording() {
  if (micRecording) return;
  try {
    micStream = await navigator.mediaDevices.getUserMedia({ audio: true });
    micChunks = [];
    micDiscardOnStop = false;
    micRecorder = createMediaRecorder(micStream);
    micRecorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) micChunks.push(event.data);
    };
    micRecorder.onstop = async () => {
      const blob = new Blob(micChunks, { type: micRecorder.mimeType || "audio/webm" });
      micChunks = [];
      if (!micDiscardOnStop) {
        await submitMicTranscription(blob);
      }
      micDiscardOnStop = false;
    };
    micRecorder.start();
    micRecording = true;
    showToast(t("mic.recording"));
  } catch (err) {
    micRecording = false;
    showToast(t("mic.no_data_notice"));
  }
}

function stopMicRecording(discard = false) {
  if (!micRecorder || !micRecording) return;
  micDiscardOnStop = !!discard;
  micRecording = false;
  micRecorder.stop();
  if (micStream) {
    micStream.getTracks().forEach((track) => track.stop());
    micStream = null;
  }
}

async function submitMicTranscription(blob) {
  const jobId = getMicJobId();
  const micBehavior = readPanelBehaviorSettingsLocal().mic || { longpress_ms: LONGPRESS_MS, max_hold_sec: Math.round(getHoldMaxMs() / 1000) };
  try {
    const res = await fetch("/api/mic/transcribe", {
      method: "POST",
      headers: {
        "content-type": blob.type || "application/octet-stream",
        "x-cssos-wake-spell": String(state.spell || DEFAULT_SPELL),
        "x-cssos-longpress-ms": String(micBehavior.longpress_ms || LONGPRESS_MS),
        "x-cssos-capture-max-sec": String(micBehavior.max_hold_sec || Math.round(getHoldMaxMs() / 1000))
      },
      body: blob
    });
    const payload = await res.json().catch(() => null);
    const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    if (payload?.ok) {
      micState.transcript = String(data?.transcript || "").trim();
      micState.lang = String(data?.lang || "en").trim() || "en";
      micState.jobId = String(data?.job_id || payload?.job_id || jobId || "").trim() || jobId;
      return;
    }
    micState.transcript = "";
    micState.jobId = payload?.job_id || jobId;
    showToast(t("mic.no_data_notice"));
  } catch (err) {
    micState.transcript = "";
    showToast(t("mic.no_data_notice"));
  }
}

function forceResetHoldRing() {
  micHoldState.active = false;
  if (micHoldState.raf) cancelAnimationFrame(micHoldState.raf);
  if (micHoldState.timeout) clearTimeout(micHoldState.timeout);
  if (micHoldState.startTimer) clearTimeout(micHoldState.startTimer);
  micHoldState.raf = 0;
  micHoldState.timeout = 0;
  micHoldState.startTimer = 0;
  micHoldState.pointerId = null;
  document.body.classList.remove("holding-mic");
  document.body.classList.remove("longpress-guard");
  showRing(false);
  setRingProgress01(0);
  if (!micRecState.started) {
    stopLogoMicPulse();
  }
}

function setLongpressGuard(on) {
  document.body.classList.toggle("longpress-guard", !!on);
}

function micHoldStart(origin) {
  if (micHoldState.active) return;
  micHoldState.active = true;
  document.body.classList.add("holding-mic");
  setLongpressGuard(true);
  micHoldState.startedAt = performance.now();
  setRingProgress01(0);
  showRing(true);
  setMicCaptureStatus(
    "holding",
    loginCopy("Hold to record"),
    loginCopy(`Keep holding on ${origin === "mirror" || origin === "mic" ? "the mirror/mic" : "this control"}. When recording starts, the mirror will flash and the status here will switch to recording.`)
  );

  const tick = () => {
    if (!micHoldState.active) return;
    const now = performance.now();
    const p = (now - micHoldState.startedAt) / getHoldMaxMs();
    setRingProgress01(p);
    micHoldState.raf = requestAnimationFrame(tick);
  };
  micHoldState.raf = requestAnimationFrame(tick);

  micHoldState.startTimer = window.setTimeout(() => {
    if (!micHoldState.active) return;
    window.dispatchEvent(new CustomEvent("cssos:mic_hold_start", { detail: { origin } }));
  }, LONGPRESS_MS);

  micHoldState.timeout = window.setTimeout(() => {
    if (!micHoldState.active) return;
    micHoldCommit({ reason: "timeout" });
  }, getHoldMaxMs());
}

window.__cssosMicHoldStart = micHoldStart;

function micHoldCommit(meta) {
  if (!micHoldState.active) return;
  const elapsed = performance.now() - micHoldState.startedAt;
  micHoldState.lastCommittedAt = Date.now();
  forceResetHoldRing();
  window.dispatchEvent(
    new CustomEvent("cssos:mic_hold_commit", {
      detail: { elapsed_ms: Math.round(elapsed), ...meta }
    })
  );
}

function bindHoldTargets() {
  const targets = Array.from(document.querySelectorAll("[data-hold='mic']"));
  for (const el of targets) {
    el.addEventListener("pointerdown", (e) => {
      if (!micHoldState || typeof micHoldState !== "object") return;
      if (e.button !== undefined && e.button !== 0) return;
      if (micHoldState.active) {
        forceResetHoldRing();
      }
      micHoldState.pointerId = e.pointerId;
      const origin = el.closest(".dock-item") ? "dock" : "logo";
      micHoldStart(origin);
    });

    const finish = (e, reason) => {
      if (!micHoldState || typeof micHoldState !== "object") return;
      if (!micHoldState.active) return;
      if (micHoldState.pointerId !== null && e && e.pointerId !== undefined && e.pointerId !== micHoldState.pointerId) return;
      const elapsed = performance.now() - micHoldState.startedAt;
      if (elapsed >= LONGPRESS_MS) {
        micHoldState.suppressClickUntil = Date.now() + 800;
        e?.preventDefault?.();
        e?.stopPropagation?.();
        micHoldCommit({ reason });
        return;
      }
      forceResetHoldRing();
    };

    el.addEventListener("pointerup", (e) => finish(e, "release"));
    el.addEventListener("pointercancel", (e) => finish(e, "cancel"));
    el.addEventListener("lostpointercapture", (e) => finish(e, "cancel"));
    if (!el.closest(".dock-item") && !el.closest("#logo-panel")) {
      el.addEventListener("click", (e) => {
        if (Date.now() < Number(micHoldState.suppressClickUntil || 0)) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        if (Date.now() - Number(micHoldState.lastCommittedAt || 0) < 450) {
          e.preventDefault();
          e.stopPropagation();
          return;
        }
        e.preventDefault();
        e.stopPropagation();
        window.dispatchEvent(new CustomEvent("cssos:mic", { detail: { origin: "logo" } }));
      });
    }
  }
}

let micRecState = {
  stream: null,
  mr: null,
  chunks: [],
  started: false
};

function pickRecorderMimeType() {
  if (typeof MediaRecorder === "undefined" || typeof MediaRecorder.isTypeSupported !== "function") {
    return "";
  }
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/mp4;codecs=mp4a.40.2",
    "audio/aac"
  ];
  return candidates.find((mime) => MediaRecorder.isTypeSupported(mime)) || "";
}

function createMediaRecorder(stream) {
  if (typeof MediaRecorder === "undefined") {
    throw new Error("MediaRecorder unavailable");
  }
  const mimeType = pickRecorderMimeType();
  return mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
}

async function startRecording() {
  if (micRecState.started) return;
  setMicCaptureStatus(
    "requesting",
    loginCopy("Connecting microphone..."),
    loginCopy("Grant microphone permission once, then keep holding to record.")
  );
  micRecState.chunks = [];
  micRecState.stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  const mr = createMediaRecorder(micRecState.stream);
  micRecState.mr = mr;
  micRecState.started = true;
  pulseLogoForMic("recording", getHoldMaxMs());

  mr.ondataavailable = (ev) => {
    if (ev.data && ev.data.size > 0) micRecState.chunks.push(ev.data);
  };

  mr.start(250);
  setMicCaptureStatus(
    "recording",
    loginCopy("Recording in progress"),
    loginCopy("Keep holding. Release to submit the captured voice for title parsing and creation.")
  );
}

async function stopRecordingGetBlob() {
  if (!micRecState.started || !micRecState.mr) return null;

  const mr = micRecState.mr;
  const stream = micRecState.stream;

  const blob = await new Promise((resolve) => {
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try {
        mr.ondataavailable = null;
      } catch {}
      resolve(new Blob(micRecState.chunks, { type: mr.mimeType || "audio/webm" }));
    };
    mr.onstop = finish;
    try {
      mr.stop();
    } catch {
      finish();
    }
    setTimeout(finish, 1200);
  });

  micRecState.started = false;
  micRecState.mr = null;
  micRecState.stream = null;
  micRecState.chunks = [];

  if (stream) {
    for (const tr of stream.getTracks()) {
      try {
        tr.stop();
      } catch {}
    }
  }

  stopLogoMicPulse();
  if (!blob || blob.size === 0) {
    revokeMicCaptureAudioUrl();
    micState.lastAudioSize = 0;
    setMicCaptureStatus(
      "empty",
      loginCopy("No usable voice captured"),
      loginCopy("This time the audio clip was empty. You can try again, or tap once to use direct lyric magic.")
    );
    return null;
  }
  revokeMicCaptureAudioUrl();
  micState.lastAudioUrl = URL.createObjectURL(blob);
  micState.lastAudioSize = blob.size;
  setMicCaptureStatus(
    "captured",
    loginCopy("Voice clip captured"),
    loginCopy("Release accepted. The system is now extracting transcript and title intent.")
  );
  renderMicCaptureStatus();
  return blob;
}

async function deriveTitleFromVoice(blob) {
  const micBehavior = readPanelBehaviorSettingsLocal().mic || { longpress_ms: LONGPRESS_MS, max_hold_sec: Math.round(getHoldMaxMs() / 1000) };
  const buf = await blob.arrayBuffer();
  if (buf.byteLength < 1600) {
    const empty = { transcript: "", title: "", wakeDetected: false };
    updateMicDebugState(empty, { wakeSpell: String(state.spell || DEFAULT_SPELL) });
    setMicCaptureStatus(
      "empty",
      loginCopy("Voice clip too short"),
      loginCopy("The clip was captured, but it was too short to parse a title reliably.")
    );
    return empty;
  }
  try {
    setMicCaptureStatus(
      "transcribing",
      loginCopy("Transcribing voice..."),
      loginCopy("The system is checking wake spell, transcript, and title intent.")
    );
    const res = await fetch("/api/mic/transcribe", {
      method: "POST",
      headers: {
        "content-type": blob.type || "application/octet-stream",
        "x-cssos-wake-spell": String(state.spell || DEFAULT_SPELL),
        "x-cssos-longpress-ms": String(micBehavior.longpress_ms || LONGPRESS_MS),
        "x-cssos-capture-max-sec": String(micBehavior.max_hold_sec || Math.round(getHoldMaxMs() / 1000))
      },
      body: blob
    });
    const payload = await res.json().catch(() => null);
    const data = payload?.data && typeof payload.data === "object" ? payload.data : payload;
    const transcript = String(data?.transcript || "").trim();
    const intent = parseVoiceIntent(transcript, {
      wakeSpell: String(state.spell || DEFAULT_SPELL)
    });
    updateMicDebugState(intent, { wakeSpell: String(state.spell || DEFAULT_SPELL) });
    setMicCaptureStatus(
      intent?.wakeDetected ? "recognized" : "transcribed",
      intent?.wakeDetected
        ? loginCopy("Wake spell recognized")
        : loginCopy("Voice transcribed"),
      transcript
        ? loginCopy(`Transcript: ${transcript.slice(0, 120)}`)
        : loginCopy("No clear transcript was found. The system will fall back to direct title generation.")
    );
    return intent;
  } catch {
    const empty = { transcript: "", title: "", wakeDetected: false };
    updateMicDebugState(empty, { wakeSpell: String(state.spell || DEFAULT_SPELL) });
    setMicCaptureStatus(
      "transcribe_failed",
      loginCopy("Voice transcription unavailable"),
      loginCopy("This capture will fall back to direct lyric generation.")
    );
    return empty;
  }
}

function escapeRegexLiteral(value) {
  return String(value || "").replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function splitVoiceTranscriptSegments(transcript) {
  return String(transcript || "")
    .split(/[\n，,。.!！？?、:：；;]/)
    .map((part) => part.trim())
    .filter(Boolean)
    .slice(0, 8);
}

function detectVoiceWorkType(transcript) {
  const raw = String(transcript || "").trim();
  if (!raw) return "";
  if (/三部曲|triptych/i.test(raw)) return "triptych";
  if (/歌剧|opera/i.test(raw)) return "opera";
  if (/歌曲|单曲|歌\b|song/i.test(raw)) return "single";
  return "";
}

function sanitizeVoiceTitleCandidate(value, options = {}) {
  const wakeSpell = String(options?.wakeSpell || state.spell || DEFAULT_SPELL).trim() || DEFAULT_SPELL;
  const stopPattern = new RegExp(
    [
      "[，,。.!！？?、:：；;]",
      "\\blet'?s\\s*go\\b",
      "\\bok(?:ay)?\\b",
      "\\bgo\\b",
      escapeRegexLiteral(wakeSpell),
      "ＣＳＳ",
      "关键词",
      "记住",
      "你要",
      "一定要",
      "是关键词",
      "哦",
      "哈",
      "哈哈+",
      "你好",
      "天才你好",
      "请你",
      "这样可以了吧",
      "可以了吧",
      "对不对",
      "好吗",
      "好吧"
    ].join("|"),
    "i"
  );
  let candidate = String(value || "").trim();
  if (!candidate) return "";
  candidate = candidate.replace(/^[是叫名为叫做关于]\s*/g, "").trim();
  const stopMatch = candidate.match(stopPattern);
  if (stopMatch && typeof stopMatch.index === "number") {
    candidate = candidate.slice(0, stopMatch.index).trim();
  }
  candidate = candidate
    .replace(new RegExp(`\\b${escapeRegexLiteral(wakeSpell)}\\b`, "gi"), " ")
    .replace(/ＣＳＳ/g, " ")
    .replace(/\blet'?s\s*go\b/gi, " ")
    .replace(/[《》"“”'‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!candidate) return "";
  if (/[\u4e00-\u9fff]/.test(candidate)) {
    const compact = candidate.replace(/\s+/g, "");
    return compact.slice(0, 12).trim();
  }
  return candidate.split(/\s+/).slice(0, 5).join(" ").slice(0, 32).trim();
}

function buildVoiceTitleCandidates(transcript, options = {}) {
  const wakeSpell = String(options?.wakeSpell || state.spell || DEFAULT_SPELL).trim() || DEFAULT_SPELL;
  const raw = String(transcript || "").trim();
  const candidates = [];
  const pushCandidate = (label, value) => {
    const cleaned = sanitizeVoiceTitleCandidate(value, { wakeSpell });
    if (!cleaned) return;
    if (candidates.some((item) => item.value === cleaned)) return;
    candidates.push({ label, value: cleaned });
  };
  const directMatchers = [
    ["opera-tight", /(?:歌剧|opera)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i],
    ["triptych-tight", /(?:三部曲|triptych)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i],
    ["song-tight", /(?:歌曲|单曲|歌)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i],
    ["after-opera", /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌曲|歌|single|triptych|opera|song|music|\s)*?(?:歌剧|opera)\s*([^\n，,。.!！？?、:：；;]+)/i],
    ["after-triptych", /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌曲|歌|opera|song|music|\s)*?(?:三部曲|triptych)\s*([^\n，,。.!！？?、:：；;]+)/i],
    ["after-song", /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌剧|三部曲|single|triptych|opera|song|music|\s)*?(?:歌曲|歌)\s*([^\n，,。.!！？?、:：；;]+)/i]
  ];
  for (const [label, matcher] of directMatchers) {
    const match = raw.match(matcher);
    if (match?.[1]) pushCandidate(label, match[1]);
  }
  const keywordMention = raw.match(/([^\s，,。.!！？?、:：；;]{2,16})\s*是关键词/);
  if (keywordMention?.[1]) pushCandidate("keyword", keywordMention[1]);
  splitVoiceTranscriptSegments(raw).forEach((segment, index) => pushCandidate(`segment-${index + 1}`, segment));
  return candidates.slice(0, 6);
}

function deriveVoiceKeywordTitle(transcript, options = {}) {
  const raw = String(transcript || "").trim();
  if (!raw) return "";
  const wakeSpell = String(options?.wakeSpell || state.spell || DEFAULT_SPELL).trim() || DEFAULT_SPELL;
  const commandPattern = new RegExp(
    [
      escapeRegexLiteral(wakeSpell),
      "css",
      "ＣＳＳ",
      "帮我",
      "请",
      "给我",
      "创作",
      "写",
      "生成",
      "做",
      "来一首",
      "一首",
      "一段",
      "一支",
      "歌曲",
      "歌",
      "歌词",
      "标题",
      "主题",
      "关于",
      "想要",
      "我想",
      "我要",
      "请你",
      "帮我写",
      "帮我生成"
    ].join("|"),
    "gi"
  );
  const quoted = raw.match(/[《\"“](.+?)[》\"”]/);
  if (quoted?.[1]) {
    return sanitizeVoiceTitleCandidate(String(quoted[1]).trim(), { wakeSpell });
  }
  const directMatchers = [
    /(?:歌剧|opera)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i,
    /(?:三部曲|triptych)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i,
    /(?:歌曲|单曲|歌)\s*[《\"“”]?([\u4e00-\u9fffA-Za-z0-9]{2,16})/i,
    /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌曲|歌|single|triptych|opera|song|music|\s)*?(?:歌剧|opera)\s*([^\n，,。.!！？?、:：；;]+)/i,
    /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌曲|歌|opera|song|music|\s)*?(?:三部曲|triptych)\s*([^\n，,。.!！？?、:：；;]+)/i,
    /(?:请(?:帮我)?|帮我|给我|我要|我想|麻烦你|嘿.*?请)?\s*创作(?:一首)?(?:中国古风|国风|古风|中国风|摇滚|爵士|说唱|嘻哈|民谣|流行|抒情|史诗|戏曲|歌剧|三部曲|single|triptych|opera|song|music|\s)*?(?:歌曲|歌)\s*([^\n，,。.!！？?、:：；;]+)/i
  ];
  for (const matcher of directMatchers) {
    const directInstruction = raw.match(matcher);
    if (directInstruction?.[1]) {
      const precise = sanitizeVoiceTitleCandidate(directInstruction[1], { wakeSpell });
      if (precise) return precise;
    }
  }
  const keywordMention = raw.match(/([^\s，,。.!！？?、:：；;]{2,16})\s*是关键词/);
  if (keywordMention?.[1]) {
    const precise = sanitizeVoiceTitleCandidate(keywordMention[1], { wakeSpell });
    if (precise) return precise;
  }
  const cleaned = raw
    .replace(commandPattern, " ")
    .replace(/[，,。.!！？?、:：；;（）()\[\]【】<>《》\"“”'‘’]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return "";
  const segments = cleaned
    .split(/\s+/)
    .map((part) => part.trim())
    .filter(Boolean)
    .filter((part) => !/^(那个|这个|一下|一种|有点|就是|然后|或者|以及|还有|一下子)$/.test(part));
  const candidate = segments.join(" ").trim() || cleaned;
  if (!candidate) return "";
  return sanitizeVoiceTitleCandidate(candidate, { wakeSpell });
}

function parseVoiceIntent(transcript, options = {}) {
  const raw = String(transcript || "").trim();
  const lower = raw.toLowerCase();
  const wakeSpell = String(options?.wakeSpell || state.spell || DEFAULT_SPELL).trim() || DEFAULT_SPELL;
  const wakePattern = new RegExp(`\\b${escapeRegexLiteral(wakeSpell.toLowerCase())}\\b`, "i");
  const wakeDetected = wakePattern.test(lower) || raw.includes("ＣＳＳ");
  let cleaned = raw
    .replace(new RegExp(`\\b${escapeRegexLiteral(wakeSpell)}\\b`, "gi"), " ")
    .replace(/[，,。.!！？]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const patterns = [
    /创作(?:一首)?(.+?)(?:歌剧)\s*[《\"]?([^》\"]+)[》\"]?/,
    /创作(?:一首)?(.+?)(?:三部曲)\s*[《\"]?([^》\"]+)[》\"]?/,
    /创作(?:一首)?(.+?)(?:歌曲|歌)\s*[《\"]?([^》\"]+)[》\"]?/,
    /(?:歌剧)\s*[《\"]?([^》\"]+)[》\"]?/,
    /(?:三部曲)\s*[《\"]?([^》\"]+)[》\"]?/,
    /(?:歌曲|歌)\s*[《\"]?([^》\"]+)[》\"]?/,
    /创作\s*[《\"]?([^》\"]+)[》\"]?/
  ];
  let title = "";
  for (const p of patterns) {
    const m = cleaned.match(p);
    if (!m) continue;
    title = sanitizeVoiceTitleCandidate(m[2] || m[1] || "", { wakeSpell });
    if (title) break;
  }
  if (!title && cleaned.length > 1) {
    title = deriveVoiceKeywordTitle(cleaned, { wakeSpell });
  }

  const infer = {
    genre: "",
    mood: "",
    instrument: "",
    ambience: ""
  };
  if (/古风|国风|中国风/.test(raw)) infer.genre = "Chinese GuFeng";
  if (/摇滚/.test(raw)) infer.genre = "Rock";
  if (/爵士/.test(raw)) infer.genre = "Jazz";
  if (/说唱|嘻哈/.test(raw)) infer.genre = "Hip Hop";

  if (/悲|伤感|忧郁/.test(raw)) infer.mood = "Sad";
  if (/欢快|开心|喜悦/.test(raw)) infer.mood = "Joyous";
  if (/浪漫|深情/.test(raw)) infer.mood = "Romantic";

  if (/古筝|琵琶/.test(raw)) infer.instrument = "Piano";
  if (/吉他/.test(raw)) infer.instrument = "Guitar";
  if (/小提琴/.test(raw)) infer.instrument = "Violin";
  if (/鼓/.test(raw)) infer.instrument = "Drums";

  if (/雨|雨夜/.test(raw)) infer.ambience = "Rain";
  if (/海浪|海边/.test(raw)) infer.ambience = "Waves";
  if (/森林|林间/.test(raw)) infer.ambience = "Forest";
  if (/篝火/.test(raw)) infer.ambience = "Campfire";

  const workType = detectVoiceWorkType(raw) || detectVoiceWorkType(cleaned) || "single";
  const panelCommand =
    typeof parsePanelVoiceCommandModule === "function"
      ? parsePanelVoiceCommandModule(raw)
      : null;
  return { transcript: raw, title, wakeDetected, infer, workType, panelCommand };
}

function updateMicDebugState(intent, options = {}) {
  const transcript = String(intent?.transcript || micState.transcript || "").trim();
  const wakeSpell = String(options?.wakeSpell || state.spell || DEFAULT_SPELL).trim() || DEFAULT_SPELL;
  micState.debug = {
    transcript,
    finalTitle: String(intent?.title || options?.fallbackTitle || "").trim(),
    wakeDetected: !!intent?.wakeDetected,
    wakeSpell,
    workType: String(intent?.workType || "").trim(),
    transcriptSegments: splitVoiceTranscriptSegments(transcript),
    titleCandidates: buildVoiceTitleCandidates(transcript, { wakeSpell })
  };
  if (advancedPanelSettings && !advancedPanelSettings.hidden) {
    void renderAdvancedPanelSettings();
  }
}

function applyVoiceIntentToCreationState(intent) {
  if (!intent || typeof intent !== "object") return;
  if (intent.panelCommand && typeof executePanelVoiceCommandModule === "function") {
    executePanelVoiceCommandModule(intent.transcript || "", { announce: false });
    return;
  }
  if (intent.infer?.genre) creationState.selections.genre = intent.infer.genre;
  if (intent.infer?.mood) creationState.selections.mood = intent.infer.mood;
  if (intent.infer?.instrument) creationState.selections.instrument = intent.infer.instrument;
  if (intent.infer?.ambience) creationState.selections.ambience = intent.infer.ambience;
  if (intent.workType) creationState.workType = normalizeWorkTypeClient(intent.workType);
  if (intent.transcript) creationState.prompt = String(intent.transcript).slice(0, 500);
  if (titleInput && intent.title) titleInput.value = intent.title;
  syncCreationStateToLegacyInputs();
  renderCreationConsole();
}

async function submitVoiceOrFallbackTitle(blobOrNull) {
  if (globalThis.isCreationBusyModule?.()) {
    showToast(t("watch.toast.creationBusy"));
    return false;
  }
  if (authState.user && !creatorBoostState.loaded) {
    await loadCreatorBoostState().catch(() => null);
  }
  const derivedDurationSec = resolveCreationDurationValue();
  const capability = enforceCreationCapability({
    mode: "music_video",
    durationSec:
      Number.isFinite(Number(derivedDurationSec)) && Number(derivedDurationSec) > 0
        ? Number(derivedDurationSec)
        : null,
    workType: creationState.workType,
    allowCinemaBookingPrompt: false
  });
  if (!capability.ok) return;
  let title = "";
  let voice = { bytes: 0, mime: "audio/webm", mode: normalizeWorkTypeClient(creationState.workType || "single") };
  let rawVoiceId = null;

  if (blobOrNull && blobOrNull.size > 0) {
    rawVoiceId = `${getMicJobId()}:raw:${Date.now()}`;
    micState.rawVoiceId = rawVoiceId;
    micState.rawVoiceDeleted = false;
    micState.creationSource = "voice";
    const intent = await deriveTitleFromVoice(blobOrNull).catch(() => ({ transcript: "", title: "", wakeDetected: false }));
    if (intent?.transcript) {
      micState.transcript = intent.transcript;
      if (typeof executePanelVoiceCommandModule === "function" && executePanelVoiceCommandModule(intent.transcript)) {
        setMicCaptureStatus(
          "submitted",
          loginCopy("Panel command accepted"),
          loginCopy("The requested panel has been opened.")
        );
        return true;
      }
      applyVoiceIntentToCreationState(intent);
      if (intent.wakeDetected) {
        showToast(loginCopy("Wake spell recognized."));
      }
    }
    if (intent?.title && intent.title.trim()) {
      title = intent.title.trim();
      setSongSeedTitleValue(title, { userEdited: true });
    }
    const ab = await blobOrNull.arrayBuffer().catch(() => null);
    if (ab && ab.byteLength > 0) {
      voice = {
        bytes: blobOrNull.size,
        mime: blobOrNull.type || "audio/webm",
        b64: globalThis.b64FromArrayBuffer?.(ab) || "",
        mode: normalizeWorkTypeClient(creationState.workType || intent?.workType || "single")
      };
    }
  }

  if (!title) {
    setMicCaptureStatus(
      "fallback",
      loginCopy("Refining title from captured voice"),
      blobOrNull && blobOrNull.size > 0
        ? loginCopy(
            "Voice was captured, but the title is still unstable. The system will now continue by generating a concise title and lyrics."
          )
        : loginCopy(
            "This action did not capture voice, so the system is directly generating a title and lyrics."
          )
    );
    if (!title && micState.transcript) {
      title = deriveVoiceKeywordTitle(micState.transcript, {
        wakeSpell: String(state.spell || DEFAULT_SPELL)
      });
      if (title) setSongSeedTitleValue(title, { userEdited: true });
    }
    if (!title) {
      title = buildDirectCreationFallbackTitle();
      if (title) setSongSeedTitleValue(title, { userEdited: false });
    }
  }
  updateMicDebugState(
    {
      transcript: micState.transcript || "",
      title,
      wakeDetected: !!micState.debug?.wakeDetected
    },
    {
      wakeSpell: String(state.spell || DEFAULT_SPELL),
      fallbackTitle: title
    }
  );
  const finalTitle = title || buildDirectCreationFallbackTitle();
  const creationPayload = normalizeSongCreationPayload({
    source: voice.bytes > 0 ? "voice" : "manual",
    title: finalTitle,
    rawVoiceId,
    rawTranscript: micState.transcript || "",
    isSongSeedTitleUserEdited: false,
    workType: normalizeWorkTypeClient(creationState.workType || voice.mode || "single")
  });
  state.songSeed = {
    ...(state.songSeed || {}),
    draft: creationPayload
  };
  if (finalTitle) {
    setSongSeedTitleValue(finalTitle, { userEdited: creationPayload.isSongSeedTitleUserEdited });
  }
  setMicCaptureStatus(
    "submitting",
    loginCopy("Creating from captured voice"),
    loginCopy(`Final title: ${finalTitle}`)
  );

  const uiLang = (window.CSS_UI_LANG || document.documentElement.lang || "zh").toString();
  const tier = getAccessTier();
  const immediateFallbackLyrics = String(lyricsInput?.value || "").trim();
  const optimisticWork = upsertLocalWorkRecord({
    local_id: `voice_${Date.now()}`,
    title: finalTitle,
    style: String(styleInput?.value || state.style || "").trim(),
    work_type: creationPayload.workType,
    structure_role: creationPayload.workType,
    status: "queued",
    created_at: new Date().toISOString(),
    lyrics_preview: "",
    source: creationPayload.source,
    raw_voice_id: creationPayload.rawVoiceId || "",
    raw_transcript: creationPayload.rawTranscript,
    show_voice_source_badge: creationPayload.source === "voice",
    is_song_seed_title_user_edited: creationPayload.isSongSeedTitleUserEdited,
    cover_image: currentWorkCoverImage(finalTitle, compactLyricLines(immediateFallbackLyrics.split("\n")))
  });
  const optimisticWorkId = String(optimisticWork?.local_id || optimisticWork?.work_id || "").trim();
  currentWatchPreviewWork = optimisticWork;
  void refreshWorkSurfaces();
  globalThis.openMinimalCreationResultSurfaceModule?.({
    preferredTab: "mv",
  });
  watchSubtitle.textContent = loginCopy("KaraOKe MV · Pending");
  try {
    const r = await createRun({ title: finalTitle, uiLang, tier, voice });
    if (optimisticWorkId) {
      updateLocalWorkRecord(optimisticWorkId, {
        status: "generating_lyrics",
        source_run_id: String(r?.run_id || "").trim()
      });
      void refreshWorkSurfaces();
    }
    window.dispatchEvent(new CustomEvent("cssos:run_created", { detail: r }));
    window.dispatchEvent(new CustomEvent("cssos:title_ready", { detail: { title: finalTitle, source: voice.bytes > 0 ? "voice" : "random", work_type: normalizeWorkTypeClient(creationState.workType || voice.mode || "single") } }));
    window.dispatchEvent(new CustomEvent("cssos:lyrics_start", { detail: { run_id: r.run_id, title: finalTitle, mode: normalizeWorkTypeClient(creationState.workType || voice.mode || "single") } }));
    setMicCaptureStatus(
      "submitted",
      loginCopy("Voice accepted"),
      loginCopy(`Creation started with title “${finalTitle}”.`)
    );
    startCreation(finalTitle, immediateFallbackLyrics, {
      ...creationPayload,
      existingRunId: String(r?.run_id || "").trim(),
      localWorkId: optimisticWorkId
    });
  } catch (_err) {
    if (optimisticWorkId) {
      updateLocalWorkRecord(optimisticWorkId, { status: "failed" });
      void refreshWorkSurfaces();
    }
    startCreation(finalTitle, immediateFallbackLyrics, {
      ...creationPayload,
      localWorkId: optimisticWorkId
    });
    setMicCaptureStatus(
      "submitting",
      loginCopy("Voice accepted"),
      loginCopy("Creation continues")
    );
    void playWatchPanelFailureFallback({ preferDemoMedia: false, allowSilence: true });
    showToast(loginCopy("Creation is continuing in the background."));
  }
}

async function handleMicClick() {
  if (globalThis.isCreationBusyModule?.()) {
    showToast(t("watch.toast.creationBusy"));
    return false;
  }
  zeroThresholdAutoplayRequested = true;
  lastZeroThresholdClickAt = Date.now();
  setMicCaptureStatus(
    "casting",
    loginCopy("Casting lyric magic"),
    loginCopy("A tap reuses the same lyric-wand generation path as advanced settings.")
  );
  try {
    startRecentRunRecovery(titleInput?.value?.trim(), { minUpdatedAtMs: lastZeroThresholdClickAt - 2000 });
    await startCreation(titleInput?.value?.trim(), lyricsInput?.value?.trim());
    window.setTimeout(async () => {
      const hasRun = !!String(currentWatchAudioRunId || activePipelineRunId || pendingFinalAudioRunId || "").trim();
      if (hasRun) return;
      if (globalThis.watchPipelineLaunchPending) return;
      if (globalThis.lyricsSeedRequestState?.pending) return;
      if (!(globalThis.hasCompleteSongSeedSnapshotModule?.(state.songSeed) ?? false)) return;
      const forcedRunId = await forceBindNewestRecentRun();
      if (!forcedRunId) return;
      currentWatchAudioRunId = forcedRunId;
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      window.dispatchEvent(
        new CustomEvent("cssos:run_created", {
          detail: { run_id: forcedRunId, title: String(titleInput?.value || state.title || "").trim() }
        })
      );
      startPipelineProgressPolling(forcedRunId);
      startPendingFinalAudioPolling(forcedRunId);
      void attemptImmediateFinalAudioAttach(forcedRunId);
    }, 4200);
    setMicCaptureStatus(
      "submitted",
      loginCopy("Lyric magic started"),
      loginCopy("This tap skipped voice capture and directly entered the title + lyric generation flow.")
    );
  } catch (error) {
    setMicCaptureStatus(
      "casting",
      loginCopy("Creation continues"),
      loginCopy("The system is continuing the one-tap creation flow for you.")
    );
    showToast(
      loginCopy(
        "Creation is continuing in the background."
      )
    );
  }
}

function handleMicLongPress() {
  // handled via pointerdown/up for recording
}

async function runMicFlow() {
  if (globalThis.isCreationBusyModule?.()) {
    showToast(t("watch.toast.creationBusy"));
    return false;
  }
  const mode = micState.transcript ? "mic" : "random";
  setMicCaptureStatus(
    "casting",
    loginCopy("Requesting lyrics and title"),
    loginCopy("The mirror is now using the lyric wand flow for this creation.")
  );
  const lyricPayload = await runLyricsGenerate(mode);
  if (globalThis.isSongSeedQuotaExceededModule?.(lyricPayload) ?? false) {
    safeShowToast(globalThis.getSongSeedQuotaExceededMessageModule?.(lyricPayload) || "");
    await startCreation(titleInput?.value?.trim(), lyricsInput?.value?.trim());
    return;
  }
  if (globalThis.isSongSeedRateLimitedModule?.(lyricPayload) ?? false) {
    safeShowToast(globalThis.getSongSeedRateLimitMessageModule?.(lyricPayload) || "");
    await startCreation(titleInput?.value?.trim(), lyricsInput?.value?.trim());
    return;
  }
  if (!lyricPayload || !lyricPayload.ok || lyricPayload.no_data) {
    setMicCaptureStatus(
      "fallback",
      loginCopy("Lyric engine returned no direct result"),
      loginCopy("The system will continue with direct title and lyric generation instead of demo playback.")
    );
    await startCreation(titleInput?.value?.trim(), lyricsInput?.value?.trim());
    return;
  }
  const title = lyricPayload.title || state.title;
  const lyricsText = lyricPayload.lyrics || "";
  if (!lyricsText) {
    setMicCaptureStatus(
      "empty",
      loginCopy("No lyric result returned"),
      loginCopy("The system will continue with direct title and lyric generation.")
    );
    await startCreation(titleInput?.value?.trim(), lyricsInput?.value?.trim());
    return;
  }
  setMicCaptureStatus(
    "ready",
    loginCopy("Lyrics ready"),
    loginCopy(`Title: ${title || "CSS MV"}`)
  );
  await startCreationWithLyrics(title, lyricsText);
}

window.__cssosBuildMicDebugBoardMarkup = buildMicDebugBoardMarkup;
window.__cssosRenderMicCaptureStatus = renderMicCaptureStatus;
window.__cssosSetLongpressGuard = setLongpressGuard;
window.__cssosBindHoldTargets = bindHoldTargets;
window.__cssosForceResetHoldRing = forceResetHoldRing;
window.__cssosHandleMicClick = handleMicClick;
window.__cssosStartRecording = startRecording;
window.__cssosStopRecordingGetBlob = stopRecordingGetBlob;
window.__cssosSubmitVoiceOrFallbackTitle = submitVoiceOrFallbackTitle;
window.__cssosRec = micRecState;
window.buildMicDebugBoardMarkup = buildMicDebugBoardMarkup;
window.renderMicCaptureStatus = renderMicCaptureStatus;
window.setLongpressGuard = setLongpressGuard;
window.bindHoldTargets = bindHoldTargets;
window.forceResetHoldRing = forceResetHoldRing;
window.handleMicClick = handleMicClick;
window.startRecording = startRecording;
window.stopRecordingGetBlob = stopRecordingGetBlob;
window.submitVoiceOrFallbackTitle = submitVoiceOrFallbackTitle;
window.setRingProgress01Module = setRingProgress01;
window.showRingModule = showRing;
