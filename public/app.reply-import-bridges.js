async function copyWatchReplyRegenerationPayloadModule(payload) {
  if (!payload) return false;
  try {
    await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
    showToast(loginCopy("Sidecar JSON copied."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Copy failed on this device."));
    return false;
  }
}

function findReplyHarmonyWindowForDraftModule(draft) {
  const normalized = normalizeWatchReplyRegenerationDraft(draft);
  if (!normalized) return null;
  const currentRunId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
  const cachedMusicPlan =
    watchMusicPlanCache.runId === currentRunId && watchMusicPlanCache.data && typeof watchMusicPlanCache.data === "object"
      ? watchMusicPlanCache.data
      : null;
  const windows = extractReplyHarmonyWindowsFromMusicPlan(cachedMusicPlan);
  if (!windows.length) return null;
  const direct = windows.find((windowEntry) => buildReplyHarmonyWindowKey(windowEntry) === normalized.windowKey);
  if (direct) return direct;
  const byTarget = windows.find((windowEntry) => {
    const sameSection = String(windowEntry?.section || "").trim() === normalized.section;
    const samePhrase = Math.max(0, Number(windowEntry?.phraseOrder || 0)) === normalized.phraseOrder;
    const sameToken = String(windowEntry?.token || "").trim() === normalized.token;
    const sameStart = Math.abs(Number(windowEntry?.startSec || 0) - normalized.startSec) <= 0.18;
    return sameSection && samePhrase && sameToken && sameStart;
  });
  if (byTarget) return byTarget;
  return (
    windows.find((windowEntry) => {
      const sameSection = String(windowEntry?.section || "").trim() === normalized.section;
      const samePhrase = Math.max(0, Number(windowEntry?.phraseOrder || 0)) === normalized.phraseOrder;
      const sameStart = Math.abs(Number(windowEntry?.startSec || 0) - normalized.startSec) <= 0.28;
      return sameSection && samePhrase && sameStart;
    }) || null
  );
}

function applyImportedDraftToLockedWindowModule(draft) {
  const normalized = normalizeWatchReplyRegenerationDraft(draft);
  if (!normalized) {
    showToast(loginCopy("That draft cannot be aligned to a Watch window."));
    return false;
  }
  const matchedWindow = findReplyHarmonyWindowForDraft(normalized);
  if (!matchedWindow) {
    showToast(loginCopy("No matching reply window was found in the current plan."));
    return false;
  }
  setWatchReplyLockedWindow(matchedWindow);
  if (normalized.loopPreferred) {
    const loopKey = buildReplyHarmonyWindowKey(matchedWindow);
    if (watchReplyLoopWindow?.key !== loopKey) {
      toggleWatchReplyWindowLoop(matchedWindow);
    } else {
      jumpWatchAudioToReplyHarmonyWindow(matchedWindow);
    }
  } else {
    jumpWatchAudioToReplyHarmonyWindow(matchedWindow);
  }
  showToast(
    loginCopy(
      `Aligned draft to ${String(matchedWindow?.token || "this window").trim() || "this window"}.`
    )
  );
  return true;
}

function promptWatchReplyRegenerationDraftImportModule() {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = ".json,application/json";
  input.style.display = "none";
  input.addEventListener(
    "change",
    async () => {
      const file = input.files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const parsed = JSON.parse(text);
        importWatchReplyRegenerationDraft(parsed);
      } catch (_err) {
        showToast(loginCopy("That draft file could not be read."));
      } finally {
        input.remove();
      }
    },
    { once: true }
  );
  document.body.appendChild(input);
  input.click();
}

function reloadWatchReplyDraftFromHistoryEntryModule(entry) {
  const normalized = normalizeWatchReplyRegenerationDraft(entry?.draft || null);
  if (!normalized) {
    showToast(loginCopy("That history entry can no longer be restored."));
    return null;
  }
  try {
    localStorage.setItem(WATCH_REPLY_REGEN_DRAFT_KEY, JSON.stringify(normalized));
    renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    updateWatchAudioDebug();
    showToast(
      loginCopy(
        `Reloaded ${normalized.token || "draft"} from history.`
      )
    );
    return normalized;
  } catch (_err) {
    showToast(loginCopy("Unable to reload that history entry right now."));
    return null;
  }
}

async function copyWatchReplyRegenerationCurlStubModule(payload) {
  if (!payload) return false;
  const body = JSON.stringify(payload, null, 2);
  const command = [
    "curl -X POST \\",
    "  \"$CSSOS_BASE_URL/cssapi/v1/music/reply-window-regenerate\" \\",
    "  -H \"Content-Type: application/json\" \\",
    "  -H \"Authorization: Bearer $CSSOS_TOKEN\" \\",
    `  --data-binary @- <<'JSON'\n${body}\nJSON`
  ].join("\n");
  try {
    await navigator.clipboard.writeText(command);
    showToast(loginCopy("Curl stub copied."));
    return true;
  } catch (_err) {
    showToast(loginCopy("Copy failed on this device."));
    return false;
  }
}

Object.assign(globalThis, {
  copyWatchReplyRegenerationPayloadModule,
  findReplyHarmonyWindowForDraftModule,
  applyImportedDraftToLockedWindowModule,
  promptWatchReplyRegenerationDraftImportModule,
  reloadWatchReplyDraftFromHistoryEntryModule,
  copyWatchReplyRegenerationCurlStubModule
});
