(() => {
const NOTIFICATIONS_STORAGE_KEY = "cssos.notifications.v1";
const NOTIFICATIONS_MAX_ITEMS = 48;

// P2-35 — inject bar styles once. We keep the CSS colocated with the
// notifications module so the styles always ship with the feature and don't
// drift out of sync with the markup.
(function ensureNotificationBarStyles() {
  if (document.getElementById("cssos-notification-bar-styles")) return;
  const st = document.createElement("style");
  st.id = "cssos-notification-bar-styles";
  st.textContent = `
.notification-run-grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 6px;
  margin: 8px 0 6px;
}
.notification-run-row {
  display: grid;
  grid-template-columns: minmax(56px, 72px) 1fr 44px;
  align-items: center;
  gap: 10px;
  font-size: 12px;
  color: rgba(232, 246, 240, 0.88);
}
.notification-run-row.is-focus {
  color: rgba(255, 255, 255, 0.98);
}
.notification-run-row > span:first-child {
  opacity: 0.82;
  letter-spacing: 0.02em;
}
/* CSSOS_PHASE2_NOTIF_LIGHT_LABELS 20260419 — on the light/day theme the
   default near-white label is invisible against the white card background.
   Force bold black so the 6 stage names read clearly. Scoped to both
   html[data-theme="light"] and body[data-theme="light"] since the app
   sets the attribute on either root (see style.css line 41 vs 83). */
html[data-theme="light"] .notification-run-row,
body[data-theme="light"] .notification-run-row {
  color: rgba(18, 22, 30, 0.88);
}
html[data-theme="light"] .notification-run-row.is-focus,
body[data-theme="light"] .notification-run-row.is-focus {
  color: rgba(0, 0, 0, 0.98);
}
html[data-theme="light"] .notification-run-row > span:first-child,
body[data-theme="light"] .notification-run-row > span:first-child {
  color: #000;
  font-weight: 700;
  opacity: 1;
}
.notification-run-row > strong {
  font-variant-numeric: tabular-nums;
  text-align: right;
  opacity: 0.92;
}
.notification-run-bar {
  position: relative;
  height: 10px;
  border-radius: 999px;
  overflow: hidden;
  background: rgba(255, 255, 255, 0.08);
  box-shadow:
    inset 0 0 0 1px rgba(255, 255, 255, 0.06),
    0 0 0 1px rgba(0, 0, 0, 0.18);
}
.notification-run-bar .notification-run-bar-fill {
  position: absolute;
  inset: 0 auto 0 0;
  display: block;
  height: 100%;
  width: 0%;
  border-radius: inherit;
  transition: width 0.4s ease;
  background-size: 200% 100%;
  background-repeat: repeat-x;
  background-position: 0% 50%;
}
/* Active state — animated scrolling rainbow seeded by per-bar hue. */
.notification-run-bar.is-active .notification-run-bar-fill {
  background-image: linear-gradient(
    90deg,
    hsl(var(--bar-hue, 0), 92%, 62%) 0%,
    hsl(calc(var(--bar-hue, 0) + 36), 92%, 60%) 22%,
    hsl(calc(var(--bar-hue, 0) + 90), 92%, 58%) 44%,
    hsl(calc(var(--bar-hue, 0) + 180), 92%, 58%) 66%,
    hsl(calc(var(--bar-hue, 0) + 270), 92%, 60%) 88%,
    hsl(var(--bar-hue, 0), 92%, 62%) 100%
  );
  animation: cssosNotificationBarScroll 1.8s linear infinite;
  box-shadow:
    0 0 12px hsla(var(--bar-hue, 0), 92%, 62%, 0.55),
    0 0 22px hsla(calc(var(--bar-hue-b, 0)), 92%, 58%, 0.28);
}
/* Completed — keep seeded hue but keep colors FLOWING (slower than active).
   CSSOS_PHASE2_FINISHED_BAR_FLOW 20260420 — user wants finished works bars
   to keep the same rainbow flow, only slower so they read as "done" vs. the
   fast-scrolling active ones. */
.notification-run-bar.is-complete .notification-run-bar-fill {
  background-image: linear-gradient(
    90deg,
    hsl(var(--bar-hue, 0), 88%, 58%) 0%,
    hsl(calc(var(--bar-hue, 0) + 36), 88%, 56%) 22%,
    hsl(calc(var(--bar-hue, 0) + 90), 88%, 54%) 44%,
    hsl(calc(var(--bar-hue, 0) + 180), 88%, 54%) 66%,
    hsl(calc(var(--bar-hue, 0) + 270), 88%, 56%) 88%,
    hsl(var(--bar-hue, 0), 88%, 58%) 100%
  );
  animation: cssosNotificationBarScroll 3.2s linear infinite;
  box-shadow:
    0 0 10px hsla(var(--bar-hue, 0), 88%, 56%, 0.45);
}
@keyframes cssosNotificationBarScroll {
  0%   { background-position:   0% 50%; }
  100% { background-position: 200% 50%; }
}
@media (prefers-reduced-motion: reduce) {
  .notification-run-bar.is-active .notification-run-bar-fill,
  .notification-run-bar.is-complete .notification-run-bar-fill {
    animation-duration: 8s;
  }
}
`;
  document.head.appendChild(st);
})();

const notificationsPanel = document.getElementById("notifications-panel");
globalThis.notificationsPanel ??= notificationsPanel;

const notificationsMeta = document.getElementById("notifications-meta");
const notificationsList = document.getElementById("notifications-list");
const notificationsEnable = document.getElementById("notifications-enable");
const notificationsMarkAll = document.getElementById("notifications-mark-all");
const notificationsClear = document.getElementById("notifications-clear");
const dockNotificationBadge = document.getElementById("dock-notification-badge");
const NOTIFICATION_PROGRESS_ROTATE_MS = 3000;
let notificationsPanelRotateTimer = null;

// CSSOS_PHASE2_P2_60_I18N 20260419 — route through CSSOS_I18N.tr() so English
// is the single source of truth. The `fallbackZh` parameter is retained for
// API compatibility with existing call sites but is now effectively unused —
// the runtime LLM translator covers every non-English locale. Legacy dict.js
// entries under `notifications.*` are still honoured via the first lookup
// (so hand-curated Chinese wins over LLM output during migration).
const notificationsLoginCopy =
  typeof globalThis.loginCopy === "function"
    ? globalThis.loginCopy.bind(globalThis)
    : (en, zh) => {
        const locale = String(globalThis.currentLocale || navigator.language || "en").toLowerCase();
        return locale.startsWith("zh") ? zh : en;
      };
const notificationsT =
  typeof globalThis.t === "function"
    ? globalThis.t.bind(globalThis)
    : (key) => String(key || "");
function notificationsTrModule(englishSource, vars) {
  try {
    const mod = globalThis.CSSOS_I18N;
    if (mod && typeof mod.tr === "function") {
      return String(mod.tr(englishSource, vars || {}));
    }
  } catch (_err) {
    /* ignore — fall through to interpolation on raw English */
  }
  const template = String(englishSource || "");
  return template.replace(/\{(\w+)\}/g, (_, token) => String(vars?.[token] ?? ""));
}
function notificationTextModule(key, fallbackEn, _fallbackZh, vars = {}) {
  // 1) dict.js wins if a hand-curated entry exists (stable translations for
  //    shipped strings never regress while LLM trains up).
  const raw = typeof notificationsT === "function" ? notificationsT(key) : "";
  if (raw && raw !== key) {
    return String(raw).replace(/\{(\w+)\}/g, (_, token) => String(vars?.[token] ?? ""));
  }
  // 2) Otherwise: English as SSOT via runtime translator.
  return notificationsTrModule(fallbackEn, vars);
}

function getBackgroundJobCapacityModule() {
  const preset = typeof getMembershipPreset === "function" ? getMembershipPreset() : null;
  const boostAvailability =
    typeof getCreatorBoostAvailability === "function" ? getCreatorBoostAvailability() : {};
  const included = Number(preset?.backgroundJobLimit ?? 0);
  const purchased = Math.max(0, Number(boostAvailability?.background_job || 0));
  const total = preset?.backgroundJobLimit === null ? null : Math.max(0, included + purchased);
  return {
    canUse: preset?.canUseBackgroundJobs === true,
    included,
    purchased,
    total,
    concurrent: Number(preset?.backgroundConcurrentJobLimit || 0),
  };
}

function sortNotificationsModule(items = []) {
  return [...(Array.isArray(items) ? items : [])].sort((a, b) => {
    const stageA = String(a?.stage || "").trim();
    const stageB = String(b?.stage || "").trim();
    const activeA = stageA === "active" ? 1 : 0;
    const activeB = stageB === "active" ? 1 : 0;
    if (activeA !== activeB) return activeB - activeA;
    return Number(b?.createdAt || 0) - Number(a?.createdAt || 0);
  });
}

function readNotificationsModule() {
  try {
    const raw = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeNotificationsModule(items) {
  try {
    localStorage.setItem(
      NOTIFICATIONS_STORAGE_KEY,
      JSON.stringify(sortNotificationsModule(items).slice(0, NOTIFICATIONS_MAX_ITEMS))
    );
  } catch (_err) {
    // ignore
  }
}

function formatNotificationTimeModule(value) {
  const safe = Number(value || 0);
  if (!safe) return "";
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    }).format(new Date(safe));
  } catch (_err) {
    return new Date(safe).toLocaleString();
  }
}

function unreadNotificationsCountModule() {
  return readNotificationsModule().filter((item) => item?.read !== true).length;
}

function syncNotificationBadgeModule() {
  if (!dockNotificationBadge) return;
  const items = readNotificationsModule();
  const unread = items.filter((item) => item?.read !== true).length;
  const active = items.filter((item) => String(item?.stage || "").trim() === "active").length;
  const visibleCount = active || unread;
  dockNotificationBadge.hidden = visibleCount <= 0;
  dockNotificationBadge.textContent = visibleCount > 99 ? "99+" : String(visibleCount || 0);
}

function maybeEmitSystemNotificationModule(item = {}) {
  if (typeof Notification === "undefined") return;
  if (Notification.permission !== "granted") return;
  try {
    const notification = new Notification(
      String(
        item.title ||
          notificationTextModule("notifications.run.readyTitle", "Your MV is ready", "你的 MV 已完成")
      ).trim(),
      {
        body: String(item.body || "").trim(),
        tag: String(item.id || "").trim() || undefined,
        renotify: true,
      }
    );
    notification.onclick = () => {
      window.focus?.();
      void openNotificationWatchModule(item.id);
      notification.close();
    };
  } catch (_err) {
    // ignore
  }
}

function upsertNotificationModule(nextItem = {}) {
  const now = Date.now();
  let items = readNotificationsModule();
  const id =
    String(nextItem.id || "").trim() ||
    `${String(nextItem.kind || "note").trim()}::${String(nextItem.runId || "").trim()}::${String(nextItem.stage || "").trim()}`;
  let index = items.findIndex((item) => String(item?.id || "").trim() === id);
  const previous = index >= 0 ? items[index] || {} : {};
  const next = {
    id,
    kind: String(nextItem.kind || "info").trim() || "info",
    stage: String(nextItem.stage || "").trim(),
    title: String(nextItem.title || "").trim() || notificationTextModule("watch.notification.update", "Update", "更新"),
    body: String(nextItem.body || "").trim(),
    runId: String(nextItem.runId || "").trim(),
    workTitle: String(nextItem.workTitle || "").trim(),
    progress: (() => {
      // CSSOS_PHASE2_NOTIF_6STAGE 20260419 — expand to 6 progress keys
      // (cover/lyrics/music/video/subtitles/compose). Progress numbers are
      // monotonic so each new event can only push a bar forward. The legacy
      // `kara` key is kept as a backward-compat input source for `compose`
      // (old run_progress emitters still write `kara`); we mirror the value
      // into both keys so any unmigrated reader also keeps working.
      const clamp = (n) => Math.max(0, Math.min(100, Number(n || 0) || 0));
      const prev = previous?.progress || {};
      const incoming = nextItem?.progress || {};
      const mono = (key, fallbackIncoming) =>
        Math.max(
          Number(prev[key] || 0) || 0,
          clamp(incoming[key] !== undefined ? incoming[key] : fallbackIncoming)
        );
      const cover = mono("cover");
      const lyrics = mono("lyrics");
      const music = mono("music");
      const video = mono("video");
      const subtitles = mono("subtitles");
      // Prefer explicit `compose` key; fall back to legacy `kara` when the
      // emitter hasn't been updated yet. Mirror the resulting value back
      // into `kara` so any legacy reader still works.
      const composeRaw =
        incoming.compose !== undefined ? incoming.compose : incoming.kara;
      const compose = Math.max(
        Number(prev.compose || prev.kara || 0) || 0,
        clamp(composeRaw)
      );
      return { cover, lyrics, music, video, subtitles, compose, kara: compose };
    })(),
    stageLabel: String(nextItem.stageLabel || "").trim(),
    createdAt: Number(nextItem.createdAt || now) || now,
    read: nextItem.read === true,
    // CSSOS_PHASE2_NOTIF_HYDRATE 20260429 #180 — Jing
    // "通知面板，用户点击进去，没有欣赏到点击进来的歌，而是等着输出一首新的歌".
    // The Watch open path (openNotificationWatchModule) hydrates
    // cssmvPipelineLastResult from these fields to skip a fresh runAll().
    // Preserve them through upsert so emitters that include them aren't
    // silently dropped here. Falls back to previous value so a partial
    // update doesn't blow away an earlier completion's URLs.
    mvUrl: String(nextItem.mvUrl || nextItem.mv_url || previous.mvUrl || "").trim(),
    audioUrl: String(nextItem.audioUrl || nextItem.audio_url || previous.audioUrl || "").trim(),
    coverUrl: String(nextItem.coverUrl || nextItem.cover_url || previous.coverUrl || "").trim(),
    subtitlesSrt: String(nextItem.subtitlesSrt || nextItem.subtitles_srt || previous.subtitlesSrt || "").trim(),
    workId: String(nextItem.workId || nextItem.work_id || previous.workId || "").trim(),
    duration: Number(nextItem.duration || previous.duration || 0) || 0,
  };
  if (next.stage === "active") {
    items = items.filter((item) => {
      const sameId = String(item?.id || "").trim() === id;
      if (sameId) return true;
      const sameStage = String(item?.stage || "").trim() === "active";
      if (!sameStage) return true;
      const sameRun = next.runId && String(item?.runId || "").trim() === next.runId;
      if (sameRun) return false;
      const sameTitle =
        next.workTitle &&
        String(item?.workTitle || "").trim() &&
        String(item?.workTitle || "").trim() === next.workTitle;
      return !sameTitle;
    });
    index = items.findIndex((item) => String(item?.id || "").trim() === id);
  }
  if (index >= 0) {
    items[index] = { ...items[index], ...next };
  } else {
    items.unshift(next);
  }
  writeNotificationsModule(items);
  syncNotificationBadgeModule();
  renderNotificationsPanelModule();
  if (next.read !== true && document.hidden) {
    maybeEmitSystemNotificationModule(next);
  }
  return next;
}

function removeNotificationModule(id = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return;
  const items = readNotificationsModule().filter((item) => String(item?.id || "").trim() !== safeId);
  writeNotificationsModule(items);
  syncNotificationBadgeModule();
  renderNotificationsPanelModule();
}

function classifyNotificationBucketModule(item = {}) {
  const kind = String(item?.kind || "").trim();
  const stage = String(item?.stage || "").trim();
  if (kind === "permission" || kind === "billing") return "membership";
  if (kind === "system" || kind === "recovery" || kind === "error") return "system";
  if (stage === "ready" || stage === "complete") return "completed";
  if (stage === "active") {
    const progress = item?.progress || {};
    // Count all 6 pipeline stages so the card classifies as "running" the
    // moment any of cover/lyrics/music/video/subtitles/compose ticks up.
    const composeProgress =
      progress.compose !== undefined ? progress.compose : progress.kara;
    const total =
      Number(progress.cover || 0) +
      Number(progress.lyrics || 0) +
      Number(progress.music || 0) +
      Number(progress.video || 0) +
      Number(progress.subtitles || 0) +
      Number(composeProgress || 0);
    return total > 0 ? "running" : "queued";
  }
  return "completed";
}

function classifyNotificationTopicModule(item = {}) {
  const kind = String(item?.kind || "").trim().toLowerCase();
  const stageLabel = String(item?.stageLabel || "").trim().toLowerCase();
  const title = String(item?.title || "").trim().toLowerCase();
  const body = String(item?.body || "").trim().toLowerCase();
  const haystack = `${kind} ${stageLabel} ${title} ${body}`;
  if (haystack.includes("thumbnail") || haystack.includes("cover") || haystack.includes("缩略图") || haystack.includes("封面")) return "thumbnail";
  if (kind === "billing" || kind === "permission" || haystack.includes("slot") || haystack.includes("membership") || haystack.includes("会员") || haystack.includes("后台位")) return "billing";
  if (kind === "system" || kind === "recovery" || kind === "error" || haystack.includes("recover") || haystack.includes("恢复")) return "recovery";
  if (haystack.includes("lyric") || haystack.includes("歌词")) return "lyrics";
  if (haystack.includes("music") || haystack.includes("audio") || haystack.includes("音乐")) return "music";
  if (haystack.includes("video") || haystack.includes("视频")) return "video";
  if (haystack.includes("subtitle") || haystack.includes("字幕")) return "subtitles";
  if (haystack.includes("compose") || haystack.includes("合成") || haystack.includes("kara") || haystack.includes("mv")) return "compose";
  return "general";
}

function notificationTopicTitleModule(topic = "general") {
  const key = `notifications.topic.${String(topic || "general").trim() || "general"}`;
  return notificationTextModule(key, String(topic || "General"), String(topic || "综合"));
}

function notificationFocusKeyModule(item = {}) {
  // 6-stage rotation (cover/lyrics/music/video/subtitles/compose). The card
  // re-renders every NOTIFICATION_PROGRESS_ROTATE_MS (3s), so the focus
  // highlight moves stage-by-stage through whichever ones are still
  // running. When all 6 have landed we settle on `compose` as the final
  // focus state.
  const progress = item?.progress || {};
  const composeValue =
    progress.compose !== undefined ? progress.compose : progress.kara;
  const keys = [
    { key: "cover", value: Number(progress.cover || 0) },
    { key: "lyrics", value: Number(progress.lyrics || 0) },
    { key: "music", value: Number(progress.music || 0) },
    { key: "video", value: Number(progress.video || 0) },
    { key: "subtitles", value: Number(progress.subtitles || 0) },
    { key: "compose", value: Number(composeValue || 0) },
  ].filter((entry) => entry.value < 100);
  if (!keys.length) return "compose";
  const rotateIndex = Math.floor(Date.now() / NOTIFICATION_PROGRESS_ROTATE_MS) % keys.length;
  return keys[rotateIndex]?.key || keys[0]?.key || "cover";
}

// P2-35 — deterministic per-id random color so that every progress bar gets
// its own hue, but the hue stays stable across re-renders (monotonic
// progress ticks cause many renders per second). A simple 32-bit hash keeps
// the hue deterministic for a notification id + bar key pair.
function notificationBarHueModule(id = "", key = "") {
  const s = String(id || "") + "::" + String(key || "");
  let h = 2166136261;
  for (let i = 0; i < s.length; i += 1) {
    h ^= s.charCodeAt(i);
    h = (h * 16777619) >>> 0;
  }
  return h % 360;
}

function renderNotificationBarRowModule({ id, keyName, label, progress, focusKey }) {
  const hue = notificationBarHueModule(id, keyName);
  const hue2 = (hue + 47) % 360;
  const pct = Math.max(0, Math.min(100, Math.round(Number(progress || 0))));
  const complete = pct >= 100;
  const state = complete ? "is-complete" : "is-active";
  const focus = focusKey === keyName ? " is-focus" : "";
  return `
        <div class="notification-run-row${focus}">
          <span>${escapeHtml(label)}</span>
          <div class="notification-run-bar ${state}"
               style="--bar-hue: ${hue}; --bar-hue-b: ${hue2};">
            <span class="notification-run-bar-fill" style="width:${pct}%"></span>
          </div>
          <strong>${pct}%</strong>
        </div>`;
}

function renderNotificationCardModule(item = {}) {
  const id = escapeHtml(String(item?.id || "").trim());
  const title = escapeHtml(String(item?.title || "").trim());
  const body = escapeHtml(String(item?.body || "").trim());
  const time = escapeHtml(formatNotificationTimeModule(item?.createdAt));
  const runId = escapeHtml(String(item?.runId || "").trim());
  const workTitle = escapeHtml(String(item?.workTitle || "").trim());
  const stageLabel = escapeHtml(String(item?.stageLabel || "").trim());
  const coverProgress = Math.round(Number(item?.progress?.cover || 0));
  const lyricsProgress = Math.round(Number(item?.progress?.lyrics || 0));
  const musicProgress = Math.round(Number(item?.progress?.music || 0));
  const videoProgress = Math.round(Number(item?.progress?.video || 0));
  const subtitlesProgress = Math.round(Number(item?.progress?.subtitles || 0));
  // `compose` is the canonical key; `kara` is legacy backward-compat input.
  const composeRaw =
    item?.progress?.compose !== undefined ? item?.progress?.compose : item?.progress?.kara;
  const composeProgress = Math.round(Number(composeRaw || 0));
  const focusKey = notificationFocusKeyModule(item);
  const rawId = String(item?.id || "").trim();
  // CSSOS_PHASE2_FINISHED_BARS_PERSIST 20260420 — also render the progress
  // grid for Finished Works (completed bucket) so the filled rainbow bars
  // stay visible (per Jing 2026-04-20: "Finished Works，进度条驻留，不要隐藏").
  // When the stage is "ready"/"complete", the progress values feeding
  // renderNotificationBarRowModule may be <100, so we snap them to 100 for
  // the completed bucket — the bar is there as a "this is done" affordance,
  // not a live progress indicator.
  const bucketClass = classifyNotificationBucketModule(item);
  const isActiveStage = String(item?.stage || "").trim() === "active";
  const isCompletedBucket = bucketClass === "completed";
  const renderBars = isActiveStage || isCompletedBucket;
  const barProgress = (raw) => (isCompletedBucket ? 100 : Math.round(Number(raw || 0)));
  const activeMarkup =
    renderBars
      ? `
      <div class="notification-run-grid">
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "cover",
          label: notificationTopicTitleModule("cover"),
          progress: barProgress(coverProgress),
          focusKey,
        })}
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "lyrics",
          label: notificationTopicTitleModule("lyrics"),
          progress: barProgress(lyricsProgress),
          focusKey,
        })}
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "music",
          label: notificationTopicTitleModule("music"),
          progress: barProgress(musicProgress),
          focusKey,
        })}
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "video",
          label: notificationTopicTitleModule("video"),
          progress: barProgress(videoProgress),
          focusKey,
        })}
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "subtitles",
          label: notificationTopicTitleModule("subtitles"),
          progress: barProgress(subtitlesProgress),
          focusKey,
        })}
        ${renderNotificationBarRowModule({
          id: rawId,
          keyName: "compose",
          label: notificationTopicTitleModule("compose"),
          progress: barProgress(composeProgress),
          focusKey,
        })}
      </div>
      ${stageLabel ? `<div class="notification-stage-copy">${stageLabel}</div>` : ""}
    `
      : "";
  return `
    <article class="notification-card${item?.read === true ? "" : " is-unread"}" data-notification-id="${id}">
      <div class="notification-head">
        <div class="notification-title">${title}</div>
        <div class="notification-time">${time}</div>
      </div>
      <div class="notification-copy">${body}</div>
      ${activeMarkup}
      <div class="notification-meta">
        <span class="notification-chip is-topic">${escapeHtml(notificationTopicTitleModule(classifyNotificationTopicModule(item)))}</span>
        ${workTitle ? `<span class="notification-chip">${workTitle}</span>` : ""}
        ${runId ? `<span class="notification-chip">${runId}</span>` : ""}
      </div>
      <div class="notification-actions">
        <button class="cta tiny" type="button" data-notification-open="${id}">${escapeHtml(notificationTextModule("notifications.action.openWatch", "Open in Watch", "在 Watch 中打开"))}</button>
        <button class="cta ghost tiny" type="button" data-notification-read="${id}">${escapeHtml(notificationTextModule("notifications.action.markRead", "Mark read", "标记已读"))}</button>
      </div>
    </article>
  `;
}

function startNotificationsPanelRotateModule() {
  if (notificationsPanelRotateTimer) return;
  notificationsPanelRotateTimer = setInterval(() => {
    if (notificationsPanel?.classList?.contains("hidden")) return;
    renderNotificationsPanelModule();
  }, NOTIFICATION_PROGRESS_ROTATE_MS);
}

function markNotificationReadModule(id = "") {
  const safeId = String(id || "").trim();
  if (!safeId) return;
  const items = readNotificationsModule().map((item) =>
    String(item?.id || "").trim() === safeId ? { ...item, read: true } : item
  );
  writeNotificationsModule(items);
  syncNotificationBadgeModule();
  renderNotificationsPanelModule();
}

function markAllNotificationsReadModule() {
  const items = readNotificationsModule().map((item) => ({ ...item, read: true }));
  writeNotificationsModule(items);
  syncNotificationBadgeModule();
  renderNotificationsPanelModule();
}

function clearNotificationsModule() {
  writeNotificationsModule([]);
  syncNotificationBadgeModule();
  renderNotificationsPanelModule();
}

async function openNotificationWatchModule(id = "") {
  const safeId = String(id || "").trim();
  const item = readNotificationsModule().find((entry) => String(entry?.id || "").trim() === safeId);
  if (item?.runId) {
    currentWatchAudioRunId = String(item.runId || "").trim();
  }
  markNotificationReadModule(safeId);
  // CSSOS_PHASE2_NOTIF_NO_RUNALL 20260429 #184 — Jing
  // "用户点击 OPEN IN WATCH 还是会跑新的 runAll() 输出一首随机的不同歌曲".
  // Hard rule: clicking a notification card MUST NEVER trigger a fresh
  // pipeline run. Either the run is still in progress (show passive
  // progress, do nothing) or the run is complete (hydrate + play). The
  // legacy fall-through to openCurrentGeneratedWatchPlaybackModule used
  // to re-evaluate "what stage are we at?" and could call into paths
  // that auto-kicked Apply&Render. We skip that entirely.
  let didHydrate = false;
  try {
    const mvUrl = String(item?.mvUrl || item?.mv_url || item?.publicUrl || item?.public_url || "").trim();
    const audioUrl = String(item?.audioUrl || item?.audio_url || "").trim();
    const coverUrl = String(item?.coverUrl || item?.cover_url || "").trim();
    const subtitlesSrt = String(item?.subtitlesSrt || item?.subtitles_srt || "").trim();
    const title = String(item?.title || item?.workTitle || "").trim();
    const workId = String(item?.workId || item?.work_id || "").trim();
    if (mvUrl || audioUrl || workId) {
      globalThis.cssmvPipelineLastResult = {
        mvUrl,
        audioUrl,
        coverUrl,
        subtitlesSrt,
        title,
        duration: Number(item?.duration || 0) || 0,
        mvId: workId,
        runId: item?.runId || "",
        tsAt: Date.now(),
        freshMs: 24 * 60 * 60 * 1000,
        source: "notification-open"
      };
      didHydrate = !!mvUrl || !!audioUrl;
      console.info(
        "%c[notifications][open-watch] hydrated cssmvPipelineLastResult from notification %s — Watch will adopt, no re-run",
        "color:#0a8;font-weight:bold", safeId
      );
    }
  } catch (_hydrErr) { /* fall through */ }
  // Always open Watch panel + close notifications panel.
  openPanel(notificationsPanel, { focus: false, layout: false });
  if (notificationsPanel) notificationsPanel.classList.add("hidden");
  if (watchPanel) watchPanel.classList.remove("hidden");
  if (didHydrate && typeof globalThis.openWatchPreviewFlowModule === "function") {
    // openWatchPreviewFlowModule has the cssmvPipelineLastResult freshness
    // short-circuit (#137) — it pushes the URL into <video> and plays. It
    // does NOT trigger runAll on this branch.
    await globalThis.openWatchPreviewFlowModule({
      preferredTab: "mv",
      clearLimit: true,
      allowDemoFallback: false
    });
    return;
  }
  // No playable URL on this notification (run still in progress, or this
  // is a pre-deploy card without URL fields). Show the watch shell as a
  // passive viewer; do NOT fall through to anything that may trigger
  // runAll. The currently-running pipeline will publish into the watch
  // surface on its own when it finishes.
  if (typeof globalThis.openWatchPreviewShellModule === "function") {
    globalThis.openWatchPreviewShellModule({ fallbackTab: "mv" });
  }
  if (typeof globalThis.showToast === "function") {
    globalThis.showToast(
      String(document?.documentElement?.lang || "").startsWith("zh")
        ? "这个作品还在后台生成中，完成后会自动开始播放。"
        : "This piece is still rendering in the background — playback will start automatically when it finishes."
    );
  }
}

function renderNotificationsPanelModule() {
  if (!notificationsList || !notificationsMeta) return;
  const items = readNotificationsModule();
  const active = items.filter((item) => String(item?.stage || "").trim() === "active").length;
  const unread = items.filter((item) => item?.read !== true).length;
  const backgroundCapacity = getBackgroundJobCapacityModule();
  const slotCopy =
    backgroundCapacity.total === null
      ? notificationTextModule(
          "notifications.meta.unlimited",
          "{active} in use / background slots unlimited",
          "已用 {active} 个 / 后台位无限",
          { active }
        )
      : notificationTextModule(
          "notifications.meta.slots",
          "Using {active} of {total} background slots",
          "已用 {active} / 共 {total} 个后台位",
          { active, total: backgroundCapacity.total }
        );
  notificationsMeta.textContent = items.length
    ? notificationTextModule(
        "notifications.meta.summary",
        "{slots} · {unread} unread · {total} total updates",
        "{slots} · 未读 {unread} 条 · 共 {total} 条更新",
        { slots: slotCopy, unread, total: items.length }
      )
    : notificationTextModule(
        "notifications.meta.empty",
        "Waiting for the first background update.",
        "正在等待第一条后台更新。"
      );
  if (!items.length) {
    notificationsList.innerHTML = `<div class="notification-empty">${escapeHtml(notificationTextModule(
      "notifications.empty",
      "Background completions and recovery notes will appear here.",
      "后台完成提醒和恢复说明会出现在这里。"
    ))}</div>`;
    return;
  }
  const queued = items.filter((item) => classifyNotificationBucketModule(item) === "queued");
  const running = items.filter((item) => classifyNotificationBucketModule(item) === "running");
  const completed = items.filter((item) => classifyNotificationBucketModule(item) === "completed");
  const system = items.filter((item) => classifyNotificationBucketModule(item) === "system");
  const membership = items.filter((item) => classifyNotificationBucketModule(item) === "membership");
  const sections = [
    {
      title: notificationTextModule("notifications.section.queue", "Creation Queue", "创作队列"),
      items: queued,
    },
    {
      title: notificationTextModule("notifications.section.running", "Now Rendering", "正在渲染"),
      items: running,
    },
    {
      title: notificationTextModule("notifications.section.completed", "Finished Works", "作品完成"),
      items: completed,
    },
    {
      title: notificationTextModule("notifications.section.system", "System & Recovery", "系统与恢复"),
      items: system,
    },
    {
      title: notificationTextModule("notifications.section.membership", "Membership & Permissions", "会员与权限"),
      items: membership,
    },
  ].filter((section) => section.items.length);
  notificationsList.innerHTML = sections
    .map(
      (section) => {
        const topicGroups = section.items.reduce((acc, item) => {
          const topic = classifyNotificationTopicModule(item);
          if (!acc[topic]) acc[topic] = [];
          acc[topic].push(item);
          return acc;
        }, {});
        const orderedTopics = ["lyrics", "music", "video", "mv", "thumbnail", "billing", "recovery", "general"]
          .filter((topic) => Array.isArray(topicGroups[topic]) && topicGroups[topic].length);
        return `
        <section class="notification-section">
          <div class="notification-section-title">${escapeHtml(section.title)}</div>
          ${orderedTopics
            .map(
              (topic) => `
                <div class="notification-subsection">
                  <div class="notification-subsection-title">${escapeHtml(notificationTopicTitleModule(topic))}</div>
                  ${topicGroups[topic].map((item) => renderNotificationCardModule(item)).join("")}
                </div>
              `
            )
            .join("")}
        </section>
      `;
      }
    )
    .join("");
  notificationsList.querySelectorAll("[data-notification-open]").forEach((button) => {
    button.addEventListener("click", () => {
      void openNotificationWatchModule(button.getAttribute("data-notification-open") || "");
    });
  });
  notificationsList.querySelectorAll("[data-notification-read]").forEach((button) => {
    button.addEventListener("click", () => {
      markNotificationReadModule(button.getAttribute("data-notification-read") || "");
    });
  });
  if (
    backgroundCapacity.canUse &&
    backgroundCapacity.total !== null &&
    active >= Number(backgroundCapacity.total || 0)
  ) {
    notificationsList.insertAdjacentHTML(
      "afterbegin",
      `
        <section class="notification-section">
          <div class="notification-section-title">${escapeHtml(notificationTextModule("notifications.slots.full", "Background slots full", "后台位已满"))}</div>
          <article class="notification-card is-unread" data-notification-kind="membership">
            <div class="notification-title">${escapeHtml(notificationTextModule("notifications.slots.title", "All background creation slots are in use", "后台创作位已全部占满"))}</div>
            <div class="notification-copy">${escapeHtml(notificationTextModule("notifications.slots.body", "Upgrade your membership or purchase extra background queue slots to keep more works flowing behind the scenes.", "升级会员，或购买额外后台创作位，这样就能让更多作品在后台继续流转。"))}</div>
            <div class="notification-meta">
              <span class="notification-chip">${escapeHtml(notificationTextModule("notifications.slots.concurrent", "Concurrent limit {count}", "并行上限 {count}", { count: backgroundCapacity.concurrent }))}</span>
            </div>
            <div class="notification-actions">
              <button class="cta tiny" type="button" data-notification-upgrade>${escapeHtml(notificationTextModule("notifications.action.upgrade", "Upgrade membership", "升级会员"))}</button>
            </div>
            <!-- CSSOS_PHASE2_PAYMENTS 20260419 — dual-gateway "Buy background
                 slot" entry so mainland users can pay with Alipay / WeChat Pay /
                 UnionPay without routing through Stripe. -->
            <div class="pay-group">
              <div class="pay-group-head">
                <span class="pay-group-dot intl"></span>
                <span>${escapeHtml(notificationTextModule("payments.intl.label", "International · Stripe", "国外 · Stripe"))}</span>
              </div>
              <div class="pay-group-body">
                <button class="mini-btn pay-stripe" type="button" data-notification-buy-background>${escapeHtml(notificationTextModule("notifications.action.buyBackground", "Buy background slot", "购买后台创作位"))}</button>
              </div>
            </div>
            <div class="pay-group">
              <div class="pay-group-head">
                <span class="pay-group-dot cn"></span>
                <span>${escapeHtml(notificationTextModule("payments.cn.label", "China · NihaoPay", "国内 · NihaoPay"))}</span>
              </div>
              <div class="pay-group-body">
                <button class="mini-btn pay-vendor alipay" type="button" data-notification-buy-background-nihaopay="alipay">${escapeHtml(notificationTextModule("payments.vendor.alipay", "Alipay", "支付宝"))}</button>
                <button class="mini-btn pay-vendor wechatpay" type="button" data-notification-buy-background-nihaopay="wechatpay">${escapeHtml(notificationTextModule("payments.vendor.wechatpay", "WeChat Pay", "微信支付"))}</button>
                <button class="mini-btn pay-vendor unionpay" type="button" data-notification-buy-background-nihaopay="unionpay">${escapeHtml(notificationTextModule("payments.vendor.unionpay", "UnionPay", "银联"))}</button>
              </div>
            </div>
          </article>
        </section>
      `
    );
  }
  notificationsList.querySelectorAll("[data-notification-upgrade]").forEach((button) => {
    button.addEventListener("click", () => {
      openSubscriptionPanelModule?.();
    });
  });
  notificationsList.querySelectorAll("[data-notification-buy-background]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!authState.user) {
        openLoginForCreation?.(
          notificationTextModule("notifications.login.buyBackground", "Sign in first to buy background queue slots.", "请先登录后再购买后台创作位。")
        );
        return;
      }
      await createCreatorBoostCheckout?.("background_job", 1, button).catch(() => null);
    });
  });
  // CSSOS_PHASE2_PAYMENTS 20260419 — NihaoPay (Alipay / WeChat / UnionPay) entry
  // for the "Buy background slot" quick-action card in the notifications panel.
  notificationsList.querySelectorAll("[data-notification-buy-background-nihaopay]").forEach((button) => {
    button.addEventListener("click", async () => {
      if (!authState.user) {
        openLoginForCreation?.(
          notificationTextModule("notifications.login.buyBackground", "Sign in first to buy background queue slots.", "请先登录后再购买后台创作位。")
        );
        return;
      }
      if (!window.cssPaymentsCheckout || typeof window.cssPaymentsCheckout.startCheckout !== "function") {
        if (typeof showToast === "function") showToast(
          notificationTextModule("notifications.payments.notReady", "Payment gateway not ready. Please refresh and try again.", "支付通道暂未就绪，请刷新后重试。")
        );
        return;
      }
      const vendor = String(button.getAttribute("data-notification-buy-background-nihaopay") || "alipay").trim().toLowerCase();
      const pricing = (typeof readPanelBehaviorSettingsLocal === "function"
        ? readPanelBehaviorSettingsLocal()?.creator_boost
        : null) || {};
      const amountCents = Math.max(0, Math.round(Number(pricing.background_job_unit_cents || 199)));
      if (!amountCents) return;
      if (typeof showToast === "function") showToast(
        notificationTextModule("notifications.payments.redirecting", "Redirecting to the payment page...", "正在跳转到支付页面...")
      );
      try {
        await window.cssPaymentsCheckout.startCheckout({
          kind: "purchase",
          vendor,
          amount_cents: amountCents,
          trigger: button,
          note: "boost:background_job:1"
        });
      } catch (_err) {
        if (typeof showToast === "function") showToast(
          notificationTextModule("notifications.payments.checkoutFailed", "Checkout could not be started right now.", "暂时无法开启结算流程。")
        );
      }
    });
  });
}

function openNotificationsPanelModule() {
  renderNotificationsPanelModule();
  startNotificationsPanelRotateModule();
  openPanel(notificationsPanel);
  markAllNotificationsReadModule();
}

// CSSOS_PHASE2_NOTIF_MERGE 20260419 — one work = one notification card.
// Previously run_created / run_progress wrote to `run::<id>::active` and
// kara_ready wrote to `run::<id>::ready`, which produced two cards per run
// when a late progress event landed after completion. Collapse to a single
// `run::<id>` card that transitions stage: "active" → "ready".

function runNotificationIdModule(runId) {
  return `run::${String(runId || "unknown").trim()}`;
}

function runNotificationIsReadyModule(runId) {
  const safe = runNotificationIdModule(runId);
  const existing = readNotificationsModule().find(
    (item) => String(item?.id || "").trim() === safe
  );
  return existing && String(existing.stage || "").trim() === "ready";
}

window.addEventListener("cssos:run_created", (event) => {
  const detail = event?.detail || {};
  const runId = String(detail?.run_id || "").trim();
  if (!runId) return;
  // Don't regress a completed work back to "active".
  if (runNotificationIsReadyModule(runId)) return;
  upsertNotificationModule({
    id: runNotificationIdModule(runId),
    kind: "progress",
    stage: "active",
    runId,
    workTitle: String(detail?.title || state.title || "").trim(),
    title: notificationTextModule("notifications.run.backgroundTitle", "Creation is continuing in the background", "作品正在后台继续创作"),
    body: notificationTextModule("notifications.run.backgroundBody", "You can keep exploring cssOS. We will let you know when the finished MV is ready.", "你可以继续浏览 cssOS。等完整 MV 完成后，我们会来提醒你。"),
    stageLabel: notificationTextModule("notifications.run.backgroundStage", "Opening the first line and warming the stage.", "正在打开第一句，并预热整个舞台。"),
    progress: { cover: 0, lyrics: 0, music: 0, video: 0, subtitles: 0, compose: 0, kara: 0 },
    read: false,
  });
});

window.addEventListener("cssos:run_progress", (event) => {
  const detail = event?.detail || {};
  const runId = String(detail?.run_id || "").trim();
  if (!runId) return;
  // Don't regress a completed work back to "active" if a late progress event
  // arrives after kara_ready.
  if (runNotificationIsReadyModule(runId)) return;
  upsertNotificationModule({
    id: runNotificationIdModule(runId),
    kind: "progress",
    stage: "active",
    runId,
    workTitle: String(detail?.title || state.title || "").trim(),
    title: notificationTextModule("notifications.run.runningTitle", "Background creation is still moving", "后台创作仍在继续"),
    body: notificationTextModule("notifications.run.runningBody", "You can keep exploring cssOS while this piece keeps rendering in the background.", "你可以继续浏览 cssOS，这个作品会在后台继续生成。"),
    stageLabel: String(detail?.stage_label || "").trim(),
    progress: detail?.progress || {},
    read: false,
  });
});

window.addEventListener("cssos:kara_ready", (event) => {
  const detail = event?.detail || {};
  const runId = String(detail?.run_id || "").trim();
  const safeRunId = runId || "unknown";
  // Clean up any legacy split-ID cards left over from older builds so users
  // who shipped pre-merge don't see duplicates after the upgrade.
  removeNotificationModule(`run::${safeRunId}::active`);
  removeNotificationModule(`run::${safeRunId}::ready`);
  upsertNotificationModule({
    id: runNotificationIdModule(safeRunId),
    kind: "complete",
    stage: "ready",
    runId,
    // CSSOS_PHASE2_NOTIF_HYDRATE_PAYLOAD 20260429 #180 — Jing
    // The MV Pipeline now ships the final URLs through this event so a
    // click on the notification card hydrates cssmvPipelineLastResult
    // and plays the existing MV instead of kicking a fresh runAll.
    mvUrl: String(detail?.mvUrl || detail?.mv_url || "").trim(),
    audioUrl: String(detail?.audioUrl || detail?.audio_url || "").trim(),
    coverUrl: String(detail?.coverUrl || detail?.cover_url || "").trim(),
    subtitlesSrt: String(detail?.subtitlesSrt || detail?.subtitles_srt || "").trim(),
    workId: String(detail?.workId || detail?.work_id || "").trim(),
    duration: Number(detail?.duration || 0) || 0,
    workTitle: String(detail?.workTitle || detail?.title || state.title || "").trim(),
    title: notificationTextModule("notifications.run.readyTitle", "Your MV is ready", "你的 MV 已完成"),
    body: notificationTextModule("notifications.run.readyBody", "The full lyrics, music, video, and karaoke pass have all landed. Open Watch when you are ready to enjoy it.", "歌词、音乐、视频和卡拉 OK 最终成片都已落地。准备好时，打开 Watch 欣赏即可。"),
    read: false,
  });
});

notificationsEnable?.addEventListener("click", async () => {
  if (typeof Notification === "undefined") {
    showToast(notificationTextModule("notifications.alerts.unsupported", "This browser does not expose system notifications.", "当前浏览器不支持系统通知。"));
    return;
  }
  if (Notification.permission === "granted") {
    showToast(notificationTextModule("notifications.alerts.alreadyEnabled", "Browser alerts are already enabled.", "浏览器提醒已经开启。"));
    return;
  }
  const permission = await Notification.requestPermission().catch(() => "default");
  showToast(
    permission === "granted"
      ? notificationTextModule("notifications.alerts.enabled", "Browser alerts enabled.", "浏览器提醒已开启。")
      : notificationTextModule("notifications.alerts.stayOff", "Browser alerts stay off for now.", "浏览器提醒暂时未开启。")
  );
});

notificationsMarkAll?.addEventListener("click", () => {
  markAllNotificationsReadModule();
});

notificationsClear?.addEventListener("click", () => {
  clearNotificationsModule();
});

// CSSOS_PHASE2_NOTIF_MERGE 20260419 — one-time migration. Older builds stored
// two rows per run (`run::<id>::active` + `run::<id>::ready`). Collapse any
// pair in localStorage into a single `run::<id>` row so returning users stop
// seeing the same work split across two cards. Ready wins over active; if
// only one half exists we keep whatever we have but re-ID it.
(function migrateLegacyRunNotificationsOnce() {
  const items = readNotificationsModule();
  if (!items.length) return;
  const legacy = /^run::([^:]+)::(active|ready)$/;
  const byRun = new Map();
  let touched = false;
  items.forEach((item) => {
    const id = String(item?.id || "").trim();
    const m = id.match(legacy);
    if (!m) return;
    touched = true;
    const runId = m[1];
    const suffix = m[2];
    const bucket = byRun.get(runId) || {};
    bucket[suffix] = item;
    byRun.set(runId, bucket);
  });
  if (!touched) return;
  const kept = items.filter((item) => !legacy.test(String(item?.id || "").trim()));
  byRun.forEach((bucket, runId) => {
    const base = bucket.ready || bucket.active;
    if (!base) return;
    const merged = { ...base };
    if (bucket.ready && bucket.active?.progress) {
      // When we're landing on "ready", preserve the final progress snapshot
      // from the active card so the bars render full when the user pops open
      // the panel on an old completed run.
      merged.progress = { ...(bucket.active.progress || {}), ...(merged.progress || {}) };
    }
    merged.id = `run::${runId}`;
    merged.runId = runId === "unknown" ? "" : runId;
    merged.stage = bucket.ready ? "ready" : "active";
    merged.kind = bucket.ready ? "complete" : "progress";
    kept.push(merged);
  });
  writeNotificationsModule(kept);
})();

renderNotificationsPanelModule();
syncNotificationBadgeModule();

// P2-36: listen for the authoritative title resolved by the music engine and
// retro-update any already-displayed notifications that predated it. Without
// this, an "active" progress notification emitted before the music stage
// completed would keep showing the stale seed title (e.g. "战斗之心") while
// the Watch panel shows the real engine title (e.g. "月之誓言") — producing
// the "one song, three titles" bug Jing reported.
window.addEventListener("cssos:title_resolved", (event) => {
  const detail = event?.detail || {};
  const nextTitle = String(detail?.title || "").trim();
  if (!nextTitle) return;
  const runId = String(detail?.run_id || "").trim();
  const items = readNotificationsModule();
  let changed = false;
  items.forEach((item) => {
    if (!item || typeof item !== "object") return;
    const itemRunId = String(item?.runId || "").trim();
    // Only retarget notifications that belong to the same run (or, if we
    // don't know the run yet, all active progress notifications). This avoids
    // rewriting past-work notifications that happen to be stale.
    const matchesRun = runId && itemRunId === runId;
    const isActiveProgress =
      !runId &&
      String(item?.stage || "").trim() === "active" &&
      String(item?.kind || "").trim() === "progress";
    if (!matchesRun && !isActiveProgress) return;
    if (String(item?.workTitle || "").trim() === nextTitle) return;
    item.workTitle = nextTitle;
    changed = true;
  });
  if (changed) {
    writeNotificationsModule(items);
    syncNotificationBadgeModule();
    renderNotificationsPanelModule();
  }
});

globalThis.readNotificationsModule = readNotificationsModule;
globalThis.renderNotificationsPanelModule = renderNotificationsPanelModule;
globalThis.upsertNotificationModule = upsertNotificationModule;
globalThis.openNotificationsPanelModule = openNotificationsPanelModule;
globalThis.markAllNotificationsReadModule = markAllNotificationsReadModule;
globalThis.syncNotificationBadgeModule = syncNotificationBadgeModule;
})();
