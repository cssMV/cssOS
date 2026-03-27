let currentWatchPreviewWork = null;
const persistedWorkAssetSignatures = new Map();

function readLocalWorks() {
  try {
    const raw = localStorage.getItem(LOCAL_WORKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_err) {
    return [];
  }
}

function writeLocalWorks(works) {
  try {
    localStorage.setItem(LOCAL_WORKS_KEY, JSON.stringify(Array.isArray(works) ? works : []));
  } catch (_err) {
    // ignore storage quota
  }
}

function listLocalWorksForCurrentUser() {
  const ownerKey = getCurrentWorksOwnerKey();
  return filterDisplayWorkRoots(buildWorkHierarchy(readLocalWorks().filter((item) => String(item?.ownerKey || "") === ownerKey)));
}

function upsertLocalWorkRecord(work) {
  const ownerKey = getCurrentWorksOwnerKey();
  const works = readLocalWorks();
  const workId = String(work?.local_id || work?.work_id || `local_${Date.now()}`);
  const next = {
    local_id: workId,
    work_id: work?.work_id ? String(work.work_id) : undefined,
    ownerKey,
    title: String(work?.title || "").trim() || "CSS MV",
    style: String(work?.style || "").trim(),
    work_type: normalizeWorkTypeClient(work?.work_type),
    structure_role: String(work?.structure_role || work?.work_type || "single").trim(),
    structure_plan: work?.structure_plan && typeof work.structure_plan === "object" ? work.structure_plan : null,
    cover_image: String(work?.cover_image || "").trim(),
    preview_image_url: String(work?.preview_image_url || "").trim(),
    preview_video_url: String(work?.preview_video_url || "").trim(),
    status: String(work?.status || "draft"),
    created_at: work?.created_at || new Date().toISOString(),
    lyrics_text: String(work?.lyrics_text || work?.lyrics_preview || "").trim(),
    lyrics_preview: String(work?.lyrics_preview || "").trim().slice(0, 500),
    children: Array.isArray(work?.children) ? work.children : [],
    source: String(work?.source || "").trim(),
    raw_voice_id: work?.raw_voice_id ? String(work.raw_voice_id).trim() : "",
    raw_transcript: String(work?.raw_transcript || "").trim().slice(0, 500),
    show_voice_source_badge: work?.show_voice_source_badge === undefined ? undefined : Boolean(work.show_voice_source_badge),
    is_song_seed_title_user_edited: work?.is_song_seed_title_user_edited === undefined ? undefined : Boolean(work.is_song_seed_title_user_edited),
    source_run_id: String(work?.source_run_id || "").trim()
  };
  const index = works.findIndex(
    (item) =>
      String(item?.ownerKey || "") === ownerKey &&
      String(item?.local_id || item?.work_id || "") === workId
  );
  if (index >= 0) {
    works[index] = { ...works[index], ...next };
  } else {
    works.unshift(next);
  }
  writeLocalWorks(works.slice(0, 40));
  return next;
}

function updateLocalWorkRecord(workId, patch = {}) {
  const targetId = String(workId || "").trim();
  if (!targetId) return;
  const works = readLocalWorks();
  let changed = false;
  const patchNode = (node) => {
    if (!node || typeof node !== "object") return node;
    const nodeId = String(node?.work_id || node?.local_id || "").trim();
    const nextChildren = Array.isArray(node?.children) ? node.children.map((child) => patchNode(child)) : [];
    if (nodeId !== targetId) {
      if (nextChildren !== node.children) {
        return { ...node, children: nextChildren };
      }
      return node;
    }
    changed = true;
    return {
      ...node,
      ...patch,
      children: nextChildren
    };
  };
  const nextWorks = works.map((item) => patchNode(item));
  if (!changed) return;
  writeLocalWorks(nextWorks.slice(0, 40));
}

function updateLocalWorkAssets(workId, assetPatch = {}) {
  const targetId = String(workId || "").trim();
  if (!targetId) return;
  const works = readLocalWorks();
  let changed = false;
  const patchNode = (node) => {
    if (!node || typeof node !== "object") return node;
    const nodeId = String(node?.work_id || node?.local_id || "").trim();
    const nextChildren = Array.isArray(node?.children) ? node.children.map((child) => patchNode(child)) : [];
    if (nodeId === targetId) {
      const nextNode = {
        ...node,
        cover_image: String(assetPatch?.cover_image || node?.cover_image || "").trim(),
        preview_image_url: String(assetPatch?.preview_image_url || node?.preview_image_url || "").trim(),
        preview_video_url: String(assetPatch?.preview_video_url || node?.preview_video_url || "").trim(),
        children: nextChildren
      };
      changed =
        changed ||
        nextNode.cover_image !== String(node?.cover_image || "").trim() ||
        nextNode.preview_image_url !== String(node?.preview_image_url || "").trim() ||
        nextNode.preview_video_url !== String(node?.preview_video_url || "").trim();
      return nextNode;
    }
    if (nextChildren !== node.children) {
      return { ...node, children: nextChildren };
    }
    return node;
  };
  const nextWorks = works.map((item) => patchNode(item));
  if (!changed) return;
  writeLocalWorks(nextWorks.slice(0, 40));
}

async function refreshWorkSurfaces() {
  if (authState.user) {
    await loadWatchCommerce(true).catch(() => null);
  }
  renderWorksPanel();
  await loadPublicMarketWorks(true).catch(() => []);
  renderForyouMarketplace();
}

function currentRealThumbnailImage() {
  const image = String(foryouThumbImage?.src || "").trim();
  if (!image) return "";
  if (image === String(currentForyouThumbFallbackDataUrl || "").trim()) return "";
  return image;
}

function isSyntheticWorkCoverImage(uri = "") {
  return String(uri || "").trim().startsWith("data:image/svg+xml");
}

function currentRealPreviewVideoUrl() {
  const video = String(watchVideo?.currentSrc || watchVideo?.src || "").trim();
  if (!video || currentPreviewVideoIsLocalFallback) return "";
  return video;
}

function collectCurrentWorkAssetSnapshot() {
  const previewImageUrl = String(globalThis.currentPreviewFrameDataUrl || getCachedWatchFrameModule() || "").trim();
  const persistedCoverImage = String(currentWatchPreviewWork?.cover_image || "").trim();
  const currentThumb = currentRealThumbnailImage();
  const coverImage =
    (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage) ? persistedCoverImage : "") ||
    (currentThumb && !isSyntheticWorkCoverImage(currentThumb) ? currentThumb : "") ||
    previewImageUrl ||
    currentThumb;
  const previewVideoUrl = currentRealPreviewVideoUrl();
  return {
    cover_image: coverImage || null,
    preview_image_url: previewImageUrl || null,
    preview_video_url: previewVideoUrl || null
  };
}

async function persistWorkAssets(workId, assetPatch = {}) {
  const targetId = String(workId || "").trim();
  if (!authState.user || !targetId) return false;
  const payload = {
    cover_image: String(assetPatch?.cover_image || "").trim() || null,
    preview_image_url: String(assetPatch?.preview_image_url || "").trim() || null,
    preview_video_url: String(assetPatch?.preview_video_url || "").trim() || null
  };
  if (!payload.cover_image && !payload.preview_image_url && !payload.preview_video_url) return false;
  const signature = JSON.stringify(payload);
  if (persistedWorkAssetSignatures.get(targetId) === signature) return true;
  const res = await fetch(`/api/works/${encodeURIComponent(targetId)}/assets`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  const raw = await res.json().catch(() => null);
  if (!res.ok || raw?.ok === false) {
    throw new Error(raw?.code || `work_asset_update_failed:${res.status}`);
  }
  persistedWorkAssetSignatures.set(targetId, signature);
  updateLocalWorkAssets(targetId, payload);
  return true;
}

function schedulePersistCurrentWorkAssets(workId = currentPersistedRootWorkId) {
  const targetId = String(workId || "").trim();
  if (!targetId) return;
  const payload = collectCurrentWorkAssetSnapshot();
  if (!payload.cover_image && !payload.preview_image_url && !payload.preview_video_url) return;
  void persistWorkAssets(targetId, payload).catch(() => {});
}

function workCoverSubtitle(work = {}) {
  const style = String(work?.style || "").trim();
  const owner = String(work?.owner_name || work?.owner_handle || work?.owner_email || "").trim();
  return `${style || owner || "CSS Studio"}`.slice(0, 72);
}

function workCoverLines(work = {}) {
  return String(work?.lyrics_text || work?.lyrics_preview || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean)
    .filter((line) => !/^\[[^\]]+\]$/.test(line))
    .slice(0, 4);
}

function resolveWorkCoverImage(work = {}) {
  const existing = String(work?.cover_image || work?.thumbnail_url || work?.preview_image_url || "").trim();
  if (existing && isSyntheticWorkCoverImage(existing) && isDemoTemplateTitle(String(work?.title || "").trim())) {
    return "";
  }
  if (existing) return existing;
  const title = String(work?.title || "").trim() || loginCopy("Untitled", "未命名");
  return buildForyouThumbSvg(title, workCoverSubtitle(work), workCoverLines(work));
}

function syncMediaDerivedWorkCoverImage() {
  const frame = String(globalThis.currentPreviewFrameDataUrl || getCachedWatchFrameModule() || "").trim();
  if (!frame) return false;
  const persistedCoverImage = String(currentWatchPreviewWork?.cover_image || "").trim();
  if (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage)) return false;
  const currentImage = String(foryouThumbImage?.src || "").trim();
  if (currentImage === frame) return true;
  if (currentRealThumbnailImage() && !isSyntheticWorkCoverImage(currentImage)) return false;
  setForyouThumbImage(frame);
  return true;
}

function currentWorkCoverImage(title, lines = []) {
  const persistedCoverImage = String(currentWatchPreviewWork?.cover_image || "").trim();
  if (persistedCoverImage && !isSyntheticWorkCoverImage(persistedCoverImage)) return persistedCoverImage;
  const existing = currentRealThumbnailImage();
  if (existing && !isSyntheticWorkCoverImage(existing)) return existing;
  const mediaFrame = String(globalThis.currentPreviewFrameDataUrl || getCachedWatchFrameModule() || "").trim();
  if (mediaFrame) return mediaFrame;
  if (existing) return existing;
  return buildForyouThumbSvg(title, `${state.style || ""} · ${state.voice || ""}`.replace(/^ · | · $/g, ""), lines);
}

function compactLyricLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line || "").trim())
    .filter((line) => line && !/^title\s*·/i.test(line) && !/^\[[^\]]+\]$/.test(line));
}
