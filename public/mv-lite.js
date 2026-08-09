// W1822 — 本页原先所有文案都是硬编码中文。改为: 英文原文写在 dict.js 的 en 基准表,
// 标记走 data-i18n / data-i18n-placeholder / data-i18n-aria, JS 动态文案走 T(key)。
// 英文同样【不硬编码】—— 页面里的英文只是 en 词条的可见兜底, 真正的取值一律经 t()。
//
// 这是独立页, 拿不到 app.js 的 applyI18nModule(它依赖 app.js 的 state / I18N 全局),
// 所以自带下面这个二十行的轻量应用器。

const I18N = () => window.CSSOS_I18N || null;

function T(key, vars) {
  const mod = I18N();
  // t() 缺键时返回 TODO_i18n(key); 宁可回落到英文兜底也不要把它显示给用户。
  if (!mod || typeof mod.t !== "function") return "";
  const text = mod.t(key, vars || {});
  return !text || text.startsWith("TODO_i18n(") ? "" : text;
}

function applyI18n(root) {
  const scope = root || document;
  const pairs = [
    ["data-i18n", (el, text) => { el.textContent = text; }],
    ["data-i18n-placeholder", (el, text) => el.setAttribute("placeholder", text)],
    ["data-i18n-aria", (el, text) => el.setAttribute("aria-label", text)],
  ];
  pairs.forEach(([attr, set]) => {
    scope.querySelectorAll(`[${attr}]`).forEach((el) => {
      const text = T(el.getAttribute(attr));
      if (text) set(el, text);
    });
  });
}

const grid = document.getElementById("mv-lite-grid");
const count = document.getElementById("mv-lite-count");
const input = document.getElementById("mv-lite-prompt");
const button = document.getElementById("mv-lite-generate");
const hint = document.getElementById("mv-lite-hint");

const tasks = new Map();

// 非英文 locale 的译文在 /i18n/generated/<locale>.json, 到位后再整页应用一次;
// 拿不到就保持 en 兜底, 页面不会因此空白。
(async function bootI18n() {
  try {
    const mod = I18N();
    if (mod && typeof mod.ensureGeneratedLocale === "function") {
      await mod.ensureGeneratedLocale();
    }
  } catch (_) { /* 译文没到位就用英文兜底 */ }
  applyI18n(document);
})();

function updateCount() {
  count.textContent = String(tasks.size);
}

function setHint(key, vars, tone = "neutral") {
  const text = T(key, vars);
  if (text) hint.textContent = text;
  // 动态提示替换掉了静态兜底文案, 清掉 data-i18n 免得后续整页重扫把它盖回去。
  hint.removeAttribute("data-i18n");
  hint.dataset.tone = tone;
}

function buildStatusBadge(status, progress) {
  const badge = document.createElement("span");
  badge.className = `mv-lite-badge mv-lite-badge-${status}`;
  if (status === "succeeded" || status === "done") {
    badge.textContent = T("mvlite.badge.done");
  } else if (status === "failed") {
    badge.textContent = T("mvlite.badge.failed");
  } else {
    badge.textContent = `${progress || 0}%`;
  }
  return badge;
}

function createCard(taskId, prompt) {
  const article = document.createElement("article");
  article.className = "mv-lite-card";
  article.dataset.taskId = taskId;

  const title = document.createElement("h3");
  title.className = "mv-lite-card-title";
  title.textContent = prompt || T("mvlite.card.untitled");

  const statusRow = document.createElement("div");
  statusRow.className = "mv-lite-card-status";
  statusRow.appendChild(buildStatusBadge("processing", 0));

  const preview = document.createElement("div");
  preview.className = "mv-lite-preview mv-lite-preview-pending";
  preview.textContent = T("mvlite.card.generating");

  const actions = document.createElement("div");
  actions.className = "mv-lite-card-actions";

  const watchLink = document.createElement("a");
  watchLink.className = "mv-lite-link";
  watchLink.target = "_blank";
  watchLink.rel = "noreferrer";
  watchLink.textContent = T("mvlite.action.openVideo");
  watchLink.style.display = "none";

  const statusLink = document.createElement("a");
  statusLink.className = "mv-lite-link mv-lite-link-secondary";
  statusLink.target = "_blank";
  statusLink.rel = "noreferrer";
  statusLink.href = `/cssapi/v1/mv/tasks/${encodeURIComponent(taskId)}`;
  statusLink.textContent = T("mvlite.action.viewStatus");

  actions.append(watchLink, statusLink);
  article.append(title, statusRow, preview, actions);
  grid.prepend(article);

  tasks.set(taskId, {
    id: taskId,
    prompt,
    node: article,
    statusRow,
    preview,
    watchLink,
    timer: null,
  });
  updateCount();
  return tasks.get(taskId);
}

function renderVideo(card, videoUrl) {
  card.preview.innerHTML = "";
  card.preview.className = "mv-lite-preview";
  const video = document.createElement("video");
  video.src = videoUrl;
  video.autoplay = true;
  video.loop = true;
  video.muted = true;
  video.playsInline = true;
  video.controls = true;
  card.preview.appendChild(video);
  card.watchLink.href = videoUrl;
  card.watchLink.style.display = "inline-flex";
}

function renderFailure(card) {
  card.preview.className = "mv-lite-preview mv-lite-preview-failed";
  card.preview.textContent = T("mvlite.card.failed");
}

function updateCard(card, payload) {
  const status = String(payload?.status || "processing").toLowerCase();
  const progress = Number(payload?.progress || 0);
  card.statusRow.innerHTML = "";
  card.statusRow.appendChild(buildStatusBadge(status, progress));

  if (status === "done" || status === "succeeded") {
    if (payload.video_url) {
      renderVideo(card, payload.video_url);
    }
    return true;
  }

  if (status === "failed") {
    renderFailure(card);
    return true;
  }

  card.preview.className = "mv-lite-preview mv-lite-preview-pending";
  card.preview.textContent = T("mvlite.card.generatingPct", { progress });
  return false;
}

async function pollTask(card) {
  try {
    const response = await fetch(`/cssapi/v1/mv/tasks/${encodeURIComponent(card.id)}`, {
      headers: { Accept: "application/json" },
    });
    if (response.status === 404) {
      // CSSOS_PHASE2_STOP_404_POLL 20260504 — Jing
      // The run state was GC'd or never existed. Stop the poll loop
      // so DevTools doesn't keep painting red 404s every 1.2s.
      if (card.timer) { clearInterval(card.timer); card.timer = null; }
      return;
    }
    if (!response.ok) {
      throw new Error(`status ${response.status}`);
    }
    const payload = await response.json();
    const done = updateCard(card, payload);
    if (done && card.timer) {
      clearInterval(card.timer);
      card.timer = null;
    }
  } catch (error) {
    setHint("mvlite.hint.pollFailed", { message: error.message }, "error");
  }
}

// 送给生成接口的兜底提示词 —— 这是 API 载荷不是界面文案, 保持英文常量,
// 不随界面语言变化(歌词语言由后端的文明智能联动决定, 不由这里的 UI locale 决定)。
const FALLBACK_PROMPT = "a random song";

async function handleGenerate() {
  const prompt = String(input.value || "").trim();
  button.disabled = true;
  setHint("mvlite.hint.creating");

  try {
    const response = await fetch("/cssapi/v1/mv/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: prompt || FALLBACK_PROMPT,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `generate failed: ${response.status}`);
    }
    const payload = await response.json();
    const card = createCard(payload.task_id, prompt || T("mvlite.card.untitled"));
    setHint("mvlite.hint.created", null, "success");
    await pollTask(card);
    card.timer = window.setInterval(() => pollTask(card), 2500);
    input.value = "";
  } catch (error) {
    setHint("mvlite.hint.createFailed", { message: error.message }, "error");
  } finally {
    button.disabled = false;
  }
}

button?.addEventListener("click", handleGenerate);
input?.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    event.preventDefault();
    handleGenerate();
  }
});
