const grid = document.getElementById("mv-lite-grid");
const count = document.getElementById("mv-lite-count");
const input = document.getElementById("mv-lite-prompt");
const button = document.getElementById("mv-lite-generate");
const hint = document.getElementById("mv-lite-hint");

const tasks = new Map();

function updateCount() {
  count.textContent = String(tasks.size);
}

function setHint(text, tone = "neutral") {
  hint.textContent = text;
  hint.dataset.tone = tone;
}

function buildStatusBadge(status, progress) {
  const badge = document.createElement("span");
  badge.className = `mv-lite-badge mv-lite-badge-${status}`;
  if (status === "succeeded" || status === "done") {
    badge.textContent = "已完成";
  } else if (status === "failed") {
    badge.textContent = "失败";
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
  title.textContent = prompt || "随机生成";

  const statusRow = document.createElement("div");
  statusRow.className = "mv-lite-card-status";
  statusRow.appendChild(buildStatusBadge("processing", 0));

  const preview = document.createElement("div");
  preview.className = "mv-lite-preview mv-lite-preview-pending";
  preview.textContent = "正在生成视频…";

  const actions = document.createElement("div");
  actions.className = "mv-lite-card-actions";

  const watchLink = document.createElement("a");
  watchLink.className = "mv-lite-link";
  watchLink.target = "_blank";
  watchLink.rel = "noreferrer";
  watchLink.textContent = "打开视频";
  watchLink.style.display = "none";

  const statusLink = document.createElement("a");
  statusLink.className = "mv-lite-link mv-lite-link-secondary";
  statusLink.target = "_blank";
  statusLink.rel = "noreferrer";
  statusLink.href = `/cssapi/v1/mv/tasks/${encodeURIComponent(taskId)}`;
  statusLink.textContent = "查看状态";

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
  card.preview.textContent = "生成失败，请重试。";
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
  card.preview.textContent = `正在生成视频… ${progress}%`;
  return false;
}

async function pollTask(card) {
  try {
    const response = await fetch(`/cssapi/v1/mv/tasks/${encodeURIComponent(card.id)}`, {
      headers: { Accept: "application/json" },
    });
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
    setHint(`状态轮询失败：${error.message}`, "error");
  }
}

async function handleGenerate() {
  const prompt = String(input.value || "").trim();
  button.disabled = true;
  setHint("正在创建任务…");

  try {
    const response = await fetch("/cssapi/v1/mv/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        prompt: prompt || "随机生成一首歌",
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(body || `generate failed: ${response.status}`);
    }
    const payload = await response.json();
    const card = createCard(payload.task_id, prompt || "随机生成");
    setHint("任务已创建，正在自动生成歌词、音乐和 MV。", "success");
    await pollTask(card);
    card.timer = window.setInterval(() => pollTask(card), 2500);
    input.value = "";
  } catch (error) {
    setHint(`创建任务失败：${error.message}`, "error");
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
