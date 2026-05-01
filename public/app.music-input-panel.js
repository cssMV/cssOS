const musicSourceUploadState = {
  audio: null,
  midi: null,
  musicxml: null,
  scoreImage: null
};
globalThis.musicSourceUploadState = musicSourceUploadState;

const musicSourceUploadPending = {
  audio: false,
  midi: false,
  musicxml: false,
  scoreImage: false
};

let musicSourceParserDraft = null;
let musicSourceParserTaskDraft = null;
let musicSourceParserTask = null;
let musicSourceParserTaskPollTimer = 0;

function musicSourceKinds() {
  return [
    {
      key: "audio",
      label: loginCopy("Reference audio"),
      accept: "audio/*,.wav,.mp3,.m4a,.flac,.ogg",
      hint: loginCopy(
        "Upload a mature song, demo, or stem reference for future melody and arrangement extraction."
      )
    },
    {
      key: "midi",
      label: loginCopy("MIDI sketch"),
      accept: ".mid,.midi,audio/midi,audio/x-midi",
      hint: loginCopy(
        "Use MIDI when you already have notes, rhythm, or chord motion sketched out."
      )
    },
    {
      key: "musicxml",
      label: loginCopy("MusicXML score"),
      accept: ".musicxml,.xml,application/vnd.recordare.musicxml+xml,application/xml,text/xml",
      hint: loginCopy(
        "Best for structured score parsing: melody, harmony, form, and expressive markings."
      )
    },
    {
      key: "scoreImage",
      label: loginCopy("Score image"),
      accept: "image/*",
      hint: loginCopy(
        "Upload numbered notation, staff notation, or handwritten score photos for OCR and motif extraction later."
      )
    }
  ];
}

function readMusicSourceEntryLabel(entry) {
  if (entry instanceof File) {
    return String(entry.name || "").trim() || loginCopy("unnamed");
  }
  if (entry && typeof entry === "object") {
    return String(entry.file_name || "").trim() || loginCopy("unnamed");
  }
  return "";
}

function readMusicSourceEntrySize(entry) {
  if (entry instanceof File) return Number(entry.size || 0);
  if (entry && typeof entry === "object") return Number(entry.size || 0);
  return 0;
}

function readMusicSourceMetadataSummary(entry) {
  return entry && typeof entry === "object" && !(entry instanceof File)
    ? entry.metadata_summary || null
    : null;
}

function formatMusicSourceUploadSummary(entry) {
  if (!entry) {
    return loginCopy("No file selected yet.");
  }
  const name = readMusicSourceEntryLabel(entry);
  const size = readMusicSourceEntrySize(entry);
  const statusSuffix =
    entry && typeof entry === "object" && !(entry instanceof File) && entry.uploaded_at
      ? loginCopy(" · ready for this session")
      : "";
  return loginCopy(
    `${name} · ${formatFileBytes(size)}${statusSuffix}`
  );
}

function formatMusicSourceMetadataSummary(entry) {
  const metadata = readMusicSourceMetadataSummary(entry);
  if (!metadata) {
    return loginCopy(
      "After upload, this slot will show parse mode and extraction focus."
    );
  }
  const parseMode = String(metadata.parse_mode || "").trim() || loginCopy("reference");
  const extractionFocus = String(metadata.extraction_focus || "").trim() || loginCopy("style");
  const sizeBucket = String(metadata.size_bucket || "").trim() || loginCopy("small");
  return loginCopy(
    `Parse mode: ${parseMode} · Focus: ${extractionFocus} · Size: ${sizeBucket}`
  );
}

function formatMusicSourceAnalysisShell(entry) {
  const metadata = readMusicSourceMetadataSummary(entry);
  const shell = metadata?.analysis_shell || null;
  if (!shell) {
    return loginCopy(
      "After upload, this slot will show the next parser shell."
    );
  }
  const parserFamily = String(shell.parser_family || "").trim() || loginCopy("reference");
  const nextStage = String(shell.next_stage || "").trim() || loginCopy("pending");
  return loginCopy(
    `Parser: ${parserFamily} · Next: ${nextStage}`
  );
}

function formatMusicSourceParserDraftSummary(draft) {
  if (!draft || typeof draft !== "object") {
    return loginCopy(
      "Parser draft is waiting for at least one uploaded source."
    );
  }
  const parserFamily = String(draft.parser_family || "").trim() || loginCopy("pending");
  const nextStage = String(draft.next_stage || "").trim() || loginCopy("pending");
  const sourceCount = Math.max(0, Number(draft.source_count || 0) || 0);
  return loginCopy(
    `Parser draft · ${sourceCount} source(s) · ${parserFamily} -> ${nextStage}`
  );
}

function formatMusicSourceParserTaskDraftSummary(draft) {
  if (!draft || typeof draft !== "object") {
    return loginCopy(
      "Parser task draft has not been created yet."
    );
  }
  const taskKind = String(draft.task_kind || "").trim() || loginCopy("pending");
  const queueLane = String(draft.queue_lane || "").trim() || loginCopy("pending");
  return loginCopy(
    `Parser task · ${taskKind} · lane ${queueLane}`
  );
}

function formatMusicSourceParserTaskSummary(task) {
  if (!task || typeof task !== "object") {
    return loginCopy(
      "No parser task is queued yet."
    );
  }
  const status = String(task.status || "").trim() || loginCopy("queued");
  const queueLane = String(task.queue_lane || "").trim() || loginCopy("pending");
  const sourceCount = Math.max(0, Number(task.source_count || 0) || 0);
  const stage = String(task?.status_history?.[task.status_history.length - 1]?.stage || "").trim();
  const resultHint =
    task?.parser_result?.summary_line
      ? ` · ${String(task.parser_result.summary_line || "").trim()}`
      : "";
  return loginCopy(
    `Queued parser task · ${sourceCount} source(s) · ${status} · lane ${queueLane}${stage ? ` · ${stage}` : ""}${resultHint}`
  );
}

function formatMusicSourceParserResultSummary(task) {
  const result = task?.parser_result;
  if (!result || typeof result !== "object") {
    return loginCopy(
      "Parser result schema will appear here after the worker completes."
    );
  }
  const schema = String(result.schema || "").trim() || loginCopy("pending");
  const resultFamily = String(result.result_family || "").trim() || loginCopy("pending");
  const workerProtocol = String(result.worker_protocol || "").trim() || loginCopy("pending");
  const parserLane = String(result?.family_payload?.parser_lane || "").trim() || loginCopy("pending");
  const confidence = String(result?.planner_hints?.parser_confidence || "").trim() || loginCopy("pending");
  const nextWorker = String(result?.extracted_outline?.next_worker || "").trim() || loginCopy("pending");
  return loginCopy(
    `Parser result · ${resultFamily} · lane ${parserLane} · ${schema} · ${workerProtocol} · confidence ${confidence} · next ${nextWorker}`
  );
}

function buildMusicSourceUploadCardMarkup() {
  const kinds = musicSourceKinds();
  return `
    <section class="advanced-panel-card" data-advanced-panel="music-sources">
      <div class="advanced-panel-card-title">${escapeHtml(loginCopy("Music Source Uploads"))}</div>
      <div class="advanced-panel-note">${escapeHtml(
        loginCopy(
          "This intake panel stores reference material for this session and can now queue the first parser task for audio, MIDI, MusicXML, and score images."
        )
      )}</div>
      <div class="advanced-panel-note">${escapeHtml(
        loginCopy(
          "Goal: complete the input chain with text, voice, image score, file score, and later video reference."
        )
      )}</div>
      ${kinds
        .map(
          (kind) => `
            <label>
              <span>${escapeHtml(kind.label)}</span>
              <input type="file" accept="${escapeHtml(kind.accept)}" data-music-source-input="${escapeHtml(kind.key)}" />
            </label>
            <div class="advanced-panel-note">${escapeHtml(kind.hint)}</div>
            <div class="advanced-panel-note" data-music-source-summary="${escapeHtml(kind.key)}">${escapeHtml(
              formatMusicSourceUploadSummary(musicSourceUploadState[kind.key])
            )}</div>
            <div class="advanced-panel-note" data-music-source-metadata="${escapeHtml(kind.key)}">${escapeHtml(
              formatMusicSourceMetadataSummary(musicSourceUploadState[kind.key])
            )}</div>
            <div class="advanced-panel-note" data-music-source-analysis="${escapeHtml(kind.key)}">${escapeHtml(
              formatMusicSourceAnalysisShell(musicSourceUploadState[kind.key])
            )}</div>
          `
        )
        .join("")}
      <div class="advanced-panel-note" data-music-source-parser-draft>${escapeHtml(
        formatMusicSourceParserDraftSummary(musicSourceParserDraft)
      )}</div>
      <div class="advanced-panel-note" data-music-source-parser-task>${escapeHtml(
        formatMusicSourceParserTaskDraftSummary(musicSourceParserTaskDraft)
      )}</div>
      <div class="advanced-panel-note" data-music-source-parser-queued>${escapeHtml(
        formatMusicSourceParserTaskSummary(musicSourceParserTask)
      )}</div>
      <div class="advanced-panel-note" data-music-source-parser-result>${escapeHtml(
        formatMusicSourceParserResultSummary(musicSourceParserTask)
      )}</div>
      <div class="actions">
        <button class="cta ghost tiny" type="button" data-music-source-refresh>${escapeHtml(
          loginCopy("Reload session draft")
        )}</button>
        <button class="cta ghost tiny" type="button" data-music-source-build-parser-task>${escapeHtml(
          loginCopy("Queue parser task")
        )}</button>
        <button class="cta ghost tiny" type="button" data-music-source-clear="all">${escapeHtml(
          loginCopy("Clear selections")
        )}</button>
      </div>
    </section>
  `;
}

function renderMusicSourceUploadPanelMarkup() {
  return buildMusicSourceUploadCardMarkup();
}

function buildAdvancedMusicSourceSettingsSection() {
  return renderMusicSourceUploadPanelMarkup();
}

function buildMusicSourceUploadPanelDigest() {
  const loadedKinds = musicSourceKinds().filter((kind) => !!musicSourceUploadState[kind.key]);
  if (!loadedKinds.length) {
    return loginCopy(
      "No score or reference file is attached to this session yet."
    );
  }
  return loginCopy(
    `${loadedKinds.length} source slot(s) attached: ${loadedKinds.map((kind) => kind.label).join(", ")}`
  );
}

function syncMusicSourceUploadSummaries(root) {
  if (!(root instanceof Element)) return;
  musicSourceKinds().forEach((kind) => {
    const summary = root.querySelector(`[data-music-source-summary="${kind.key}"]`);
    const metadata = root.querySelector(`[data-music-source-metadata="${kind.key}"]`);
    const analysis = root.querySelector(`[data-music-source-analysis="${kind.key}"]`);
    if (summary) {
      const pending = musicSourceUploadPending[kind.key];
      summary.textContent = pending
        ? loginCopy("Uploading...")
        : formatMusicSourceUploadSummary(musicSourceUploadState[kind.key]);
    }
    if (metadata) {
      metadata.textContent = formatMusicSourceMetadataSummary(musicSourceUploadState[kind.key]);
    }
    if (analysis) {
      analysis.textContent = formatMusicSourceAnalysisShell(musicSourceUploadState[kind.key]);
    }
  });
  const parserDraft = root.querySelector("[data-music-source-parser-draft]");
  if (parserDraft) {
    parserDraft.textContent = formatMusicSourceParserDraftSummary(musicSourceParserDraft);
  }
  const parserTaskDraft = root.querySelector("[data-music-source-parser-task]");
  if (parserTaskDraft) {
    parserTaskDraft.textContent = formatMusicSourceParserTaskDraftSummary(musicSourceParserTaskDraft);
  }
  const parserTask = root.querySelector("[data-music-source-parser-queued]");
  if (parserTask) {
    parserTask.textContent = formatMusicSourceParserTaskSummary(musicSourceParserTask);
  }
  const parserResult = root.querySelector("[data-music-source-parser-result]");
  if (parserResult) {
    parserResult.textContent = formatMusicSourceParserResultSummary(musicSourceParserTask);
  }
}

async function loadMusicSourceDraft() {
  const res = await fetch("/api/music-sources/draft", {
    credentials: "include",
    cache: "no-store"
  });
  const payload = await res.json().catch(() => null);
  const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `music_source_draft_load_failed:${res.status}`);
  }
  return {
    draft: data?.draft && typeof data.draft === "object" ? data.draft : {},
    parserJobDraft: data?.parser_job_draft && typeof data.parser_job_draft === "object" ? data.parser_job_draft : null,
    parserTaskDraft: data?.parser_task_draft && typeof data.parser_task_draft === "object" ? data.parser_task_draft : null,
    parserTask: data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null
  };
}

async function buildMusicSourceParserTaskDraft() {
  const res = await fetch("/api/music-sources/parser-task-draft", {
    method: "POST",
    credentials: "include"
  });
  const payload = await res.json().catch(() => null);
  const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `music_source_parser_task_failed:${res.status}`);
  }
  return {
    parserTaskDraft: data?.parser_task_draft && typeof data.parser_task_draft === "object" ? data.parser_task_draft : null,
    parserTask: data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null
  };
}

async function queueMusicSourceParserTask() {
  const res = await fetch("/api/music-sources/parser-tasks", {
    method: "POST",
    credentials: "include"
  });
  const payload = await res.json().catch(() => null);
  const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `music_source_parser_task_queue_failed:${res.status}`);
  }
  return data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null;
}

async function loadCurrentMusicSourceParserTask() {
  const res = await fetch("/api/music-sources/parser-tasks/current", {
    credentials: "include",
    cache: "no-store"
  });
  const payload = await res.json().catch(() => null);
  const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `music_source_parser_task_status_failed:${res.status}`);
  }
  return data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null;
}

function clearMusicSourceParserTaskPolling() {
  if (musicSourceParserTaskPollTimer) {
    clearTimeout(musicSourceParserTaskPollTimer);
    musicSourceParserTaskPollTimer = 0;
  }
}

function pollMusicSourceParserTask(root) {
  clearMusicSourceParserTaskPolling();
  const status = String(musicSourceParserTask?.status || "").trim().toLowerCase();
  if (!musicSourceParserTask || !["queued", "processing"].includes(status)) return;
  musicSourceParserTaskPollTimer = window.setTimeout(async () => {
    try {
      musicSourceParserTask = await loadCurrentMusicSourceParserTask();
      syncMusicSourceUploadSummaries(root);
    } catch {}
    pollMusicSourceParserTask(root);
  }, 1500);
}

async function uploadMusicSourceFile(kind, file, trigger = null, root = null) {
  if (!(file instanceof File)) return null;
  musicSourceUploadPending[kind] = true;
  try {
    syncMusicSourceUploadSummaries(root);
    setButtonBusy?.(trigger, true);
    const dataUrl = await fileToDataUrl(file);
    const res = await fetch("/api/music-sources/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        kind,
        file_name: file.name || `${kind}.bin`,
        data_url: dataUrl
      })
    });
    const payload = await res.json().catch(() => null);
    const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
    if (!res.ok || payload?.ok === false || !data?.entry) {
      throw new Error(payload?.code || `music_source_upload_failed:${res.status}`);
    }
    musicSourceUploadState[kind] = data.entry;
    musicSourceParserDraft =
      data?.parser_job_draft && typeof data.parser_job_draft === "object" ? data.parser_job_draft : musicSourceParserDraft;
    musicSourceParserTaskDraft =
      data?.parser_task_draft && typeof data.parser_task_draft === "object" ? data.parser_task_draft : musicSourceParserTaskDraft;
    musicSourceParserTask =
      data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null;
    safeShowToast?.(
      loginCopy("Music source uploaded into this session draft.")
    );
    return data.entry;
  } catch {
    showToast?.(loginCopy("Music source upload failed."));
    return null;
  } finally {
    musicSourceUploadPending[kind] = false;
    setButtonBusy?.(trigger, false);
    syncMusicSourceUploadSummaries(root);
  }
}

async function clearMusicSourceDraft(kind) {
  const res = await fetch(`/api/music-sources/draft/${encodeURIComponent(kind)}`, {
    method: "DELETE",
    credentials: "include"
  });
  const payload = await res.json().catch(() => null);
  if (!res.ok || payload?.ok === false) {
    throw new Error(payload?.code || `music_source_clear_failed:${res.status}`);
  }
  musicSourceUploadState[kind] = null;
  const data = typeof getApiData === "function" ? getApiData(payload) : payload?.data || payload;
  musicSourceParserDraft =
    data?.parser_job_draft && typeof data.parser_job_draft === "object" ? data.parser_job_draft : null;
  musicSourceParserTaskDraft =
    data?.parser_task_draft && typeof data.parser_task_draft === "object" ? data.parser_task_draft : null;
  musicSourceParserTask =
    data?.parser_task && typeof data.parser_task === "object" ? data.parser_task : null;
}

async function hydrateMusicSourceDraft(root) {
  if (!(root instanceof Element)) return;
  try {
    const { draft, parserJobDraft, parserTaskDraft, parserTask } = await loadMusicSourceDraft();
    musicSourceKinds().forEach((kind) => {
      musicSourceUploadState[kind.key] = draft?.[kind.key] || null;
    });
    musicSourceParserDraft = parserJobDraft;
    musicSourceParserTaskDraft = parserTaskDraft;
    musicSourceParserTask = parserTask;
    syncMusicSourceUploadSummaries(root);
    pollMusicSourceParserTask(root);
  } catch {
    syncMusicSourceUploadSummaries(root);
  }
}

function bindMusicSourceUploadControls(root) {
  if (!(root instanceof Element)) return;
  root.querySelectorAll("[data-music-source-input]").forEach((input) => {
    if (!(input instanceof HTMLInputElement)) return;
    input.addEventListener("change", async () => {
      const key = String(input.getAttribute("data-music-source-input") || "").trim();
      if (!key || !(key in musicSourceUploadState)) return;
      const file = input.files?.[0] || null;
      if (!file) return;
      musicSourceUploadState[key] = file;
      syncMusicSourceUploadSummaries(root);
      const uploaded = await uploadMusicSourceFile(key, file, input, root);
      if (!uploaded) {
        input.value = "";
      }
      syncMusicSourceUploadSummaries(root);
    });
  });
  root.querySelector('[data-music-source-refresh]')?.addEventListener("click", () => {
    void hydrateMusicSourceDraft(root);
  });
  root.querySelector('[data-music-source-build-parser-task]')?.addEventListener("click", async () => {
    try {
      const result = await buildMusicSourceParserTaskDraft();
      musicSourceParserTaskDraft = result?.parserTaskDraft || null;
      musicSourceParserTask = await queueMusicSourceParserTask();
      pollMusicSourceParserTask(root);
      safeShowToast?.(
        loginCopy("Parser task is queued for the next ingest stage.")
      );
    } catch {
      showToast?.(loginCopy("Parser task could not be queued yet."));
    }
    syncMusicSourceUploadSummaries(root);
  });
  root.querySelector('[data-music-source-clear="all"]')?.addEventListener("click", async () => {
    await Promise.all(
      musicSourceKinds().map(async (kind) => {
        try {
          await clearMusicSourceDraft(kind.key);
        } catch {}
        const input = root.querySelector(`[data-music-source-input="${kind.key}"]`);
        if (input instanceof HTMLInputElement) {
          input.value = "";
        }
      })
    );
    syncMusicSourceUploadSummaries(root);
  });
  void hydrateMusicSourceDraft(root);
}

function mountMusicSourceUploadPanel(root) {
  if (!(root instanceof Element)) return;
  bindMusicSourceUploadControls(root);
}

function wireAdvancedMusicSourceUploadIntoAdvancedSettings(root) {
  if (!(root instanceof Element)) return;
  mountMusicSourceUploadPanel(root);
}

function mountMusicSourceUploadTabInSettings(root) {
  if (!(root instanceof Element)) return;
  if (root.dataset.musicSourceUploadMounted === "true") return;
  root.dataset.musicSourceUploadMounted = "true";
  root.innerHTML = renderMusicSourceUploadPanelMarkup();
  const uploadShell =
    root.querySelector('[data-advanced-panel="music-sources"]') || root;
  mountMusicSourceUploadPanel(uploadShell);
}
