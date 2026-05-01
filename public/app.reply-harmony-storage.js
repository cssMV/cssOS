function readWatchReplyLockHashStateModule() {
  try {
    const hash = String(window.location.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    const key = String(params.get("replyLock") || "").trim();
    if (!key) return null;
    return {
      runId: String(params.get("replyRun") || "").trim(),
      key,
      token: "",
      loop: String(params.get("replyLoop") || "").trim() === "1"
    };
  } catch (_err) {
    return null;
  }
}

function syncWatchReplyLockHashModule(key = "", runId = "", loop = false) {
  try {
    const url = new URL(window.location.href);
    const hash = String(url.hash || "").replace(/^#/, "");
    const params = new URLSearchParams(hash);
    if (key) {
      params.set("replyLock", key);
      if (runId) params.set("replyRun", runId);
      if (loop) params.set("replyLoop", "1");
      else params.delete("replyLoop");
    } else {
      params.delete("replyLock");
      params.delete("replyRun");
      params.delete("replyLoop");
    }
    const nextHash = params.toString();
    url.hash = nextHash ? `#${nextHash}` : "";
    window.history.replaceState({}, document.title, `${url.pathname}${url.search}${url.hash}`);
  } catch (_err) {
    // ignore hash sync issues
  }
}

function persistWatchReplyLockStateModule() {
  try {
    if (!watchReplyLockedWindow?.key) {
      localStorage.removeItem(WATCH_REPLY_LOCK_KEY);
      syncWatchReplyLockHashModule("");
      return;
    }
    const runId = String(currentWatchAudioRunId || pendingFinalAudioRunId || activePipelineRunId || "").trim();
    localStorage.setItem(
      WATCH_REPLY_LOCK_KEY,
      JSON.stringify({
        runId,
        key: watchReplyLockedWindow.key,
        token: String(watchReplyLockedWindow.token || "").trim(),
        loop: watchReplyLoopWindow?.key === watchReplyLockedWindow.key
      })
    );
    syncWatchReplyLockHashModule(
      watchReplyLockedWindow.key,
      runId,
      watchReplyLoopWindow?.key === watchReplyLockedWindow.key
    );
  } catch (_err) {
    // ignore persistence issues
  }
}

function readPersistedWatchReplyLockStateModule() {
  try {
    const raw = localStorage.getItem(WATCH_REPLY_LOCK_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return {
      runId: String(parsed.runId || "").trim(),
      key: String(parsed.key || "").trim(),
      token: String(parsed.token || "").trim(),
      loop: !!parsed.loop
    };
  } catch (_err) {
    return null;
  }
}

function copyWatchReplyLockLinkModule() {
  if (!watchReplyLockedWindow?.key) return Promise.resolve(false);
  return navigator.clipboard
    .writeText(window.location.href)
    .then(() => {
      showToast(loginCopy("Locked Watch link copied."));
      return true;
    })
    .catch(() => {
      showToast(loginCopy("Copy failed on this device."));
      return false;
    });
}

window.readWatchReplyLockHashStateModule = readWatchReplyLockHashStateModule;
window.syncWatchReplyLockHashModule = syncWatchReplyLockHashModule;
window.persistWatchReplyLockStateModule = persistWatchReplyLockStateModule;
window.readPersistedWatchReplyLockStateModule = readPersistedWatchReplyLockStateModule;
window.copyWatchReplyLockLinkModule = copyWatchReplyLockLinkModule;
