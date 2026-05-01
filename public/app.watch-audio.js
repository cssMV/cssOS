const watchAudioDebug = document.getElementById("watch-audio-debug");
const watchAudioDebugSource = document.getElementById("watch-audio-debug-source");
const watchAudioDebugPath = document.getElementById("watch-audio-debug-path");
const watchAudioDebugState = document.getElementById("watch-audio-debug-state");
const watchMicCaptureCard = document.getElementById("watch-mic-capture-card");

let currentWatchAudioSourceKind = "none";
let currentWatchAudioRunId = "";
let currentWatchAudioArtifactPath = "";
let currentWatchAudioRunError = "";
let rememberedWatchFinalAudioRunId = "";
let rememberedWatchFinalAudioArtifactPath = "";
let rememberedWatchFinalAudioUrl = "";
let latestWatchMusicStatusPayload = null;
let latestWatchMusicSnapshot = {};
let latestWatchReplyHighlightKey = "";
let latestWatchReplyActiveToken = "";
let watchReplyTokenOverride = null;
let watchReplyLockedWindow = null;
let watchReplyLoopWindow = null;
const WATCH_REPLY_LOCK_KEY = "cssos.watch.reply.lock";
const WATCH_REPLY_REGEN_DRAFT_KEY = "cssos.watch.reply.regen_draft";
const WATCH_REPLY_REGEN_HISTORY_KEY = "cssos.watch.reply.regen_history";
const LOGO_RING_PRESETS_KEY = "cssos.logo.ring.presets";
const watchMusicPlanCache = {
  runId: "",
  data: null,
  pending: false,
  error: ""
};
const watchKaraokeTimelineCache = {
  runId: "",
  data: null,
  pending: false,
  error: ""
};
const attemptedFinalAudioArtifacts = new Map();
let pendingFinalAudioRunId = "";
let pendingFinalAudioTimer = null;
let pendingFinalAudioStopTimer = null;
let pendingRecentRunRecoveryTimer = null;
let pendingRecentRunRecoveryDeadline = 0;
let pendingRecentRunRecoveryBusy = false;
let watchAudioAutoplayArmed = false;
let lastZeroThresholdClickAt = 0;
let latestWatchCreateRunRequestMeta = null;
let latestWatchCreateRunResponseMeta = null;

function setWatchCreateRunDebugMeta(kind = "response", meta = null) {
  const normalized =
    meta && typeof meta === "object"
      ? Object.fromEntries(
          Object.entries(meta).map(([key, value]) => [key, String(value ?? "").trim()])
        )
      : null;
  if (kind === "request") {
    latestWatchCreateRunRequestMeta = normalized;
    return;
  }
  latestWatchCreateRunResponseMeta = normalized;
}

function updateWatchAudioDebug() {
  if (!watchAudioDebug || !watchAudioDebugSource || !watchAudioDebugPath || !watchAudioDebugState) return;
  const sourceKind = String(currentWatchAudioSourceKind || "none").trim() || "none";
  const finalPath = String(currentWatchAudioArtifactPath || "").trim();
  const currentSrc = String(watchAudioPreview?.currentSrc || watchAudioPreview?.src || "").trim();
  const runId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  const paused = watchAudioPreview ? !!watchAudioPreview.paused : true;
  const readyState = Number(watchAudioPreview?.readyState || 0);
  const networkState = Number(watchAudioPreview?.networkState || 0);
  const mediaError = Number(watchAudioPreview?.error?.code || 0);
  const srcSummary = currentSrc.startsWith("data:audio/")
    ? "data:audio/<inline-preview>"
    : (currentSrc ? currentSrc.slice(0, 180) : "<empty>");
  watchAudioDebug.hidden = false;
  watchAudioDebugSource.textContent =
    `${t("watch.debug.currentSource")} = ${sourceKind}` +
    `${runId ? ` | run = ${runId}` : ""}` +
    `${currentWatchAudioRunError ? ` | run_error = ${currentWatchAudioRunError}` : ""}`;
  watchAudioDebugPath.textContent =
    `${t("watch.debug.finalPath")} = ${finalPath || "<empty>"}` +
    ` | src = ${srcSummary}` +
    `${latestWatchCreateRunRequestMeta?.endpoint ? ` | create=${latestWatchCreateRunRequestMeta.endpoint}` : ""}` +
    `${latestWatchCreateRunResponseMeta?.status ? ` | create_status=${latestWatchCreateRunResponseMeta.status}` : ""}`;
  watchAudioDebugState.textContent =
    `${t("watch.debug.mediaState")} = paused=${paused} | ready=${readyState} | net=${networkState} | err=${mediaError}` +
    `${latestWatchReplyActiveToken ? ` | token=${latestWatchReplyActiveToken}` : ""}` +
    `${latestWatchCreateRunResponseMeta?.runId ? ` | create_run=${latestWatchCreateRunResponseMeta.runId}` : ""}` +
    `${latestWatchCreateRunResponseMeta?.statusUrl ? ` | status_url=${latestWatchCreateRunResponseMeta.statusUrl}` : ""}` +
    `${latestWatchCreateRunResponseMeta?.note ? ` | note=${latestWatchCreateRunResponseMeta.note}` : ""}`;
}

function syncWatchAudioPresentation() {
  if (!watchSubtitle) return;
  const current = String(watchSubtitle.textContent || "").trim();
  if (currentWatchAudioSourceKind === "final-artifact") {
    if (!current || /Preview|Demo|Internal Debug Artifact|Rendering|预览|演示|调试产物|渲染/i.test(current)) {
      watchSubtitle.textContent = loginCopy("Music mix ready");
    }
    return;
  }
  if (currentWatchAudioSourceKind === "demo-audio") {
    if (!current || /Seed preview|Preview|Internal Debug Artifact|预览|调试产物/i.test(current)) {
      watchSubtitle.textContent = loginCopy("Demo audio fallback");
    }
    return;
  }
  if (currentWatchAudioSourceKind === "none" && !current) {
    globalThis.syncWatchSubtitleForWaitingMediaModule?.();
  }
}

function rememberWatchFinalAudio(runId = "", artifactPath = "", url = "") {
  const safeRunId = String(runId || "").trim();
  const safeArtifactPath = String(artifactPath || "").trim();
  const safeUrl = String(url || "").trim();
  if (!safeRunId || !safeArtifactPath || !safeUrl) return false;
  rememberedWatchFinalAudioRunId = safeRunId;
  rememberedWatchFinalAudioArtifactPath = safeArtifactPath;
  rememberedWatchFinalAudioUrl = safeUrl;
  return true;
}

function getRememberedWatchFinalAudio() {
  const activeRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  if (!activeRunId) return null;
  if (activeRunId !== String(rememberedWatchFinalAudioRunId || "").trim()) return null;
  const artifactPath = String(rememberedWatchFinalAudioArtifactPath || "").trim();
  const url = String(rememberedWatchFinalAudioUrl || "").trim();
  if (!artifactPath || !url) return null;
  return {
    runId: activeRunId,
    artifactPath,
    url
  };
}

function restoreRememberedWatchFinalAudio(options = {}) {
  if (!watchAudioPreview) return false;
  const remembered = getRememberedWatchFinalAudio();
  if (!remembered) return false;
  const currentSrc = String(watchAudioPreview.currentSrc || watchAudioPreview.src || "").trim();
  const shouldReplace =
    currentWatchAudioSourceKind !== "final-artifact" ||
    !currentSrc ||
    currentSrc.startsWith("data:audio/") ||
    currentSrc !== remembered.url;
  currentWatchAudioRunId = remembered.runId;
  currentWatchAudioArtifactPath = remembered.artifactPath;
  if (!shouldReplace) {
    currentWatchAudioSourceKind = "final-artifact";
    updateWatchAudioDebug();
    syncWatchAudioPresentation();
    return true;
  }
  const preservePlayback =
    typeof options.preservePlayback === "boolean"
      ? options.preservePlayback
      : !!(!watchAudioPreview.paused && !watchAudioPreview.ended);
  watchAudioPreview.autoplay = true;
  watchAudioPreview.playsInline = true;
  watchAudioPreview.loop = false;
  watchAudioPreview.src = remembered.url;
  watchAudioPreview.style.display = "block";
  watchAudioPreview.load?.();
  currentWatchAudioSourceKind = "final-artifact";
  updateWatchAudioDebug();
  syncWatchAudioPresentation();
  if (preservePlayback || watchAudioAutoplayArmed) {
    const retryPlay = () => {
      watchAudioPreview.removeEventListener("canplay", retryPlay);
      playWatchAudioPreviewFromStartModule();
    };
    watchAudioPreview.addEventListener("canplay", retryPlay, { once: true });
  }
  return true;
}

async function recoverRecentRunId(expectedTitle = "", minUpdatedAtMs = 0) {
  try {
    const res = await fetch(`${apiBase()}/cssapi/v1/runs?limit=8`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) return "";
    const payload = await res.json().catch(() => null);
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];
    if (!items.length) return "";
    const now = Date.now();
    const desiredTitle = String(expectedTitle || "").trim().toLowerCase();
    const recent = items
      .map((item) => ({
        runId: String(item?.run_id || item?.runId || "").trim(),
        updatedAtMs: Number(item?.updated_at_ms || item?.updatedAtMs || 0),
        status: String(item?.status || "").trim().toUpperCase(),
        runDir: String(item?.run_dir || item?.runDir || "").trim().toLowerCase()
      }))
      .filter((item) => item.runId && now - item.updatedAtMs < 1000 * 60 * 3)
      .filter((item) => !minUpdatedAtMs || item.updatedAtMs >= minUpdatedAtMs)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs);
    if (!recent.length) return "";
    const titled = desiredTitle
      ? recent.find((item) => item.runDir.includes(desiredTitle))
      : null;
    return String(titled?.runId || recent[0]?.runId || "").trim();
  } catch (_err) {
    return "";
  }
}

async function forceBindNewestRecentRun() {
  try {
    const res = await fetch(`${apiBase()}/cssapi/v1/runs?limit=3`, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) return "";
    const payload = await res.json().catch(() => null);
    const items = Array.isArray(payload?.items)
      ? payload.items
      : Array.isArray(payload?.data?.items)
        ? payload.data.items
        : [];
    const newest = items
      .map((item) => ({
        runId: String(item?.run_id || item?.runId || "").trim(),
        updatedAtMs: Number(item?.updated_at_ms || item?.updatedAtMs || 0)
      }))
      .filter((item) => item.runId)
      .sort((a, b) => b.updatedAtMs - a.updatedAtMs)[0];
    return String(newest?.runId || "").trim();
  } catch (_err) {
    return "";
  }
}

function stopRecentRunRecovery() {
  pendingRecentRunRecoveryDeadline = 0;
  pendingRecentRunRecoveryBusy = false;
  if (pendingRecentRunRecoveryTimer) {
    clearInterval(pendingRecentRunRecoveryTimer);
    pendingRecentRunRecoveryTimer = null;
  }
}

function startRecentRunRecovery(expectedTitle = "", options = {}) {
  if (!(globalThis.hasCompleteSongSeedSnapshotModule?.(state.songSeed) ?? false)) return;
  stopRecentRunRecovery();
  const minUpdatedAtMs = Number(options?.minUpdatedAtMs || 0);
  pendingRecentRunRecoveryDeadline = Date.now() + 1000 * 90;
  const tick = async () => {
    if (pendingRecentRunRecoveryBusy) return;
    if (currentWatchAudioRunId || Date.now() > pendingRecentRunRecoveryDeadline) {
      stopRecentRunRecovery();
      return;
    }
    if (!(globalThis.hasCompleteSongSeedSnapshotModule?.(state.songSeed) ?? false)) {
      stopRecentRunRecovery();
      return;
    }
    pendingRecentRunRecoveryBusy = true;
    try {
      const recoveredRunId = await recoverRecentRunId(expectedTitle, minUpdatedAtMs);
      if (!recoveredRunId) return;
      currentWatchAudioRunId = recoveredRunId;
      currentWatchAudioRunError = "";
      updateWatchAudioDebug();
      window.dispatchEvent(
        new CustomEvent("cssos:run_created", {
          detail: { run_id: recoveredRunId, title: String(expectedTitle || "").trim() }
        })
      );
      startPipelineProgressPolling(recoveredRunId);
      startPendingFinalAudioPolling(recoveredRunId);
      stopRecentRunRecovery();
    } finally {
      pendingRecentRunRecoveryBusy = false;
    }
  };
  void tick();
  pendingRecentRunRecoveryTimer = setInterval(() => {
    void tick();
  }, 2000);
}
