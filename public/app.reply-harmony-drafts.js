function persistWatchReplyRegenerationDraftModule(windowEntry = null) {
  try {
    if (!windowEntry) {
      localStorage.removeItem(WATCH_REPLY_REGEN_DRAFT_KEY);
      return null;
    }
    const draft = {
      kind: "reply_harmony_window_regeneration",
      runId: String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim(),
      windowKey: buildReplyHarmonyWindowKey(windowEntry),
      token: String(windowEntry?.token || "").trim(),
      section: String(windowEntry?.section || "").trim(),
      phraseOrder: Math.max(0, Number(windowEntry?.phraseOrder || 0)),
      role: String(windowEntry?.role || "").trim(),
      cadence: String(windowEntry?.cadence || "").trim(),
      startSec: Math.max(0, Number(windowEntry?.startSec || 0)),
      durationSec: Math.max(0.2, Number(windowEntry?.durationSec || 0)),
      loopPreferred: watchReplyLoopWindow?.key === buildReplyHarmonyWindowKey(windowEntry),
      controls: {
        bassDuckBias: 0,
        stringsSettle: 0,
        densityBias: 0
      },
      importedControls: {
        bassDuckBias: 0,
        stringsSettle: 0,
        densityBias: 0
      },
      sourceArtifacts: ["./build/music.plan.json", "./build/vocals.plan.json"],
      requestedAt: new Date().toISOString(),
      status: "draft"
    };
    localStorage.setItem(WATCH_REPLY_REGEN_DRAFT_KEY, JSON.stringify(draft));
    return draft;
  } catch (_err) {
    return null;
  }
}

function readWatchReplyRegenerationDraftModule() {
  try {
    const raw = localStorage.getItem(WATCH_REPLY_REGEN_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch (_err) {
    return null;
  }
}

function readWatchReplyRegenerationHistoryModule() {
  try {
    const raw = localStorage.getItem(WATCH_REPLY_REGEN_HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((entry) => entry && typeof entry === "object") : [];
  } catch (_err) {
    return [];
  }
}

function writeWatchReplyRegenerationHistoryModule(entries) {
  try {
    localStorage.setItem(WATCH_REPLY_REGEN_HISTORY_KEY, JSON.stringify(Array.isArray(entries) ? entries.slice(0, 8) : []));
  } catch (_err) {
    // ignore persistence issues
  }
}

window.persistWatchReplyRegenerationDraftModule = persistWatchReplyRegenerationDraftModule;
window.readWatchReplyRegenerationDraftModule = readWatchReplyRegenerationDraftModule;
window.readWatchReplyRegenerationHistoryModule = readWatchReplyRegenerationHistoryModule;
window.writeWatchReplyRegenerationHistoryModule = writeWatchReplyRegenerationHistoryModule;
