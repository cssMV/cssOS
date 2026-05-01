function formatReplyHarmonyClockModule(value) {
  const seconds = Math.max(0, Number(value) || 0);
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  const fraction = Math.floor((seconds - Math.floor(seconds)) * 10);
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}.${fraction}`;
}

function extractReplyHarmonyWindowsFromMusicPlanModule(musicPlan) {
  const direct = Array.isArray(musicPlan?.replyHarmonyWindows) ? musicPlan.replyHarmonyWindows : [];
  if (direct.length) return direct;
  const cues = Array.isArray(musicPlan?.cues) ? musicPlan.cues : [];
  const merged = [];
  cues.forEach((cue) => {
    const windows = Array.isArray(cue?.replyHarmonyWindows) ? cue.replyHarmonyWindows : [];
    windows.forEach((windowEntry) => merged.push(windowEntry));
  });
  return merged;
}

function replyHarmonyWindowStrengthModule(windowEntry) {
  return clampPercent((Number(windowEntry?.strength) || 0) * 100);
}

function currentWatchAudioTimeSecModule() {
  if (!watchAudioPreview) return 0;
  const current = Number(watchAudioPreview.currentTime);
  return Number.isFinite(current) && current >= 0 ? current : 0;
}

function currentWatchAudioDurationSecModule() {
  if (!watchAudioPreview) return 0;
  const duration = Number(watchAudioPreview.duration);
  return Number.isFinite(duration) && duration > 0 ? duration : 0;
}

function buildReplyHarmonyWindowKeyModule(windowEntry) {
  return [
    String(windowEntry?.section || "").trim(),
    String(windowEntry?.token || "").trim(),
    Number(windowEntry?.startSec || 0).toFixed(3),
    Number(windowEntry?.durationSec || 0).toFixed(3)
  ].join("|");
}

window.formatReplyHarmonyClockModule = formatReplyHarmonyClockModule;
window.extractReplyHarmonyWindowsFromMusicPlanModule = extractReplyHarmonyWindowsFromMusicPlanModule;
window.replyHarmonyWindowStrengthModule = replyHarmonyWindowStrengthModule;
window.currentWatchAudioTimeSecModule = currentWatchAudioTimeSecModule;
window.currentWatchAudioDurationSecModule = currentWatchAudioDurationSecModule;
window.buildReplyHarmonyWindowKeyModule = buildReplyHarmonyWindowKeyModule;
