let currentWatchPreviewWork = null;
const persistedWorkAssetSignatures = new Map();
const WORK_SMALL_THUMB_CACHE_KEY = "cssos.work_small_thumb_cache.v1";

function looksLikeVisualPromptSummaryForWorksModule(text = "") {
  const lower = String(text || "").trim().toLowerCase();
  if (!lower) return false;
  if (
    lower.includes("cybernetic heroine") ||
    lower.includes("memory loop") ||
    lower.includes("metallic couture") ||
    lower.includes("moonlit temple") ||
    lower.includes("mirrored ballroom") ||
    lower.includes("shattered control room") ||
    lower.includes("lacquered black silk") ||
    lower.includes("return gaze finale") ||
    lower.includes("desert procession") ||
    lower.includes("collapsing horizon") ||
    lower.includes("sovereign android queen")
  ) {
    return true;
  }
  return (
    lower.includes("camera:") ||
    lower.includes("lighting:") ||
    lower.includes("environment:") ||
    lower.includes("shot brief") ||
    lower.includes("visual role") ||
    lower.includes("directing goals") ||
    lower.includes("bars:") ||
    lower.includes("focus:") ||
    lower.includes("energy:")
  );
}

function sanitizeLocalWorkRecordLyricsModule(node) {
  if (!node || typeof node !== "object") return node;
  const rawLyricsText = String(node?.lyrics_text || "").trim();
  const rawLyricsPreview = String(node?.lyrics_preview || "").trim();
  const safeLyricsText = looksLikeVisualPromptSummaryForWorksModule(rawLyricsText)
    ? ""
    : rawLyricsText;
  const safeLyricsPreview = looksLikeVisualPromptSummaryForWorksModule(
    rawLyricsPreview,
  )
    ? ""
    : rawLyricsPreview;
  const nextChildren = Array.isArray(node?.children)
    ? node.children.map((child) => sanitizeLocalWorkRecordLyricsModule(child))
    : [];
  const fallbackLyrics =
    safeLyricsText ||
    safeLyricsPreview ||
    nextChildren
      .map((child) =>
        String(child?.lyrics_text || child?.lyrics_preview || "").trim(),
      )
      .filter(Boolean)
      .join("\n")
      .trim();
  return {
    ...node,
    lyrics_text: fallbackLyrics,
    lyrics_preview: fallbackLyrics,
    children: nextChildren,
  };
}

function readLocalWorks() {
  try {
    const raw = localStorage.getItem(LOCAL_WORKS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map((item) => sanitizeLocalWorkRecordLyricsModule(item))
      : [];
  } catch (_err) {
    return [];
  }
}

function readWorkSmallThumbCache() {
  try {
    const raw = localStorage.getItem(WORK_SMALL_THUMB_CACHE_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_err) {
    return {};
  }
}

function writeWorkSmallThumbCache(cache) {
  try {
    localStorage.setItem(
      WORK_SMALL_THUMB_CACHE_KEY,
      JSON.stringify(cache && typeof cache === "object" ? cache : {})
    );
  } catch (_err) {
    // ignore storage quota
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
  const next = sanitizeLocalWorkRecordLyricsModule({
    local_id: workId,
    work_id: work?.work_id ? String(work.work_id) : undefined,
    ownerKey,
    title: String(work?.title || "").trim() || "CSS MV",
    style: String(work?.style || "").trim(),
    work_type: normalizeWorkTypeClient(work?.work_type),
    structure_role: String(work?.structure_role || work?.work_type || "single").trim(),
    structure_plan: work?.structure_plan && typeof work.structure_plan === "object" ? work.structure_plan : null,
    small_thumbnail_url: String(work?.small_thumbnail_url || work?.thumbnail_url || "").trim(),
    cover_image: String(work?.cover_image || "").trim(),
    preview_image_url: String(work?.preview_image_url || "").trim(),
    preview_video_url: String(work?.preview_video_url || "").trim(),
    preview_video_asset_key: String(work?.preview_video_asset_key || "").trim(),
    status: String(work?.status || "draft"),
    created_at: work?.created_at || new Date().toISOString(),
    lyrics_text: String(work?.lyrics_text || work?.lyrics_preview || "").trim(),
    lyrics_preview: String(work?.lyrics_preview || "").trim(),
    children: Array.isArray(work?.children) ? work.children : [],
    source: String(work?.source || "").trim(),
    raw_voice_id: work?.raw_voice_id ? String(work.raw_voice_id).trim() : "",
    raw_transcript: String(work?.raw_transcript || "").trim().slice(0, 500),
    show_voice_source_badge: work?.show_voice_source_badge === undefined ? undefined : Boolean(work.show_voice_source_badge),
    is_song_seed_title_user_edited: work?.is_song_seed_title_user_edited === undefined ? undefined : Boolean(work.is_song_seed_title_user_edited),
    source_run_id: String(work?.source_run_id || "").trim()
  });
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
        small_thumbnail_url: String(assetPatch?.small_thumbnail_url || node?.small_thumbnail_url || "").trim(),
        cover_image: String(assetPatch?.cover_image || node?.cover_image || "").trim(),
        preview_image_url: String(assetPatch?.preview_image_url || node?.preview_image_url || "").trim(),
        preview_video_url: String(assetPatch?.preview_video_url || node?.preview_video_url || "").trim(),
        preview_video_asset_key: String(assetPatch?.preview_video_asset_key || node?.preview_video_asset_key || "").trim(),
        children: nextChildren
      };
      changed =
        changed ||
        nextNode.small_thumbnail_url !== String(node?.small_thumbnail_url || "").trim() ||
        nextNode.cover_image !== String(node?.cover_image || "").trim() ||
        nextNode.preview_image_url !== String(node?.preview_image_url || "").trim() ||
        nextNode.preview_video_url !== String(node?.preview_video_url || "").trim() ||
        nextNode.preview_video_asset_key !== String(node?.preview_video_asset_key || "").trim();
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
  // CSSOS_PHASE2_RENDER_WORKS_GUARD 20260426 #142 — Jing
  // Same load-order race as getMembershipPreset: app.work-sync.js loads
  // before app.works-panel.js so the global isn't there yet on first
  // refresh. Defensive lookup.
  try {
    const _rw = (typeof globalThis.renderWorksPanel === "function")
      ? globalThis.renderWorksPanel
      : (typeof renderWorksPanel === "function" ? renderWorksPanel : null);
    if (_rw) _rw();
  } catch (_e) { /* non-fatal */ }
  await loadPublicMarketWorks(true).catch(() => []);
  if (typeof renderForyouMarketplace === "function") renderForyouMarketplace();
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

function buildPreviewVideoAssetKeyFromPath(runId, rawPath) {
  const safeRunId = String(runId || "").trim();
  const safePath = String(rawPath || "")
    .trim()
    .replace(/^[./\\]+/, "")
    .replace(/\\/g, "/")
    .replace(/^build\//i, "");
  if (!safeRunId || !safePath) return "";
  return `works/${safeRunId}/${safePath}`;
}

function derivePreviewVideoAssetKey(previewVideoUrl = "", work = currentWatchPreviewWork) {
  const raw = String(previewVideoUrl || "").trim();
  const sourceRunId = String(work?.source_run_id || currentWatchAudioRunId || activePipelineRunId || "").trim();
  if (!raw) return "";
  if (raw.startsWith("works/")) return raw;
  if (raw.startsWith("runs/")) {
    const match = raw.match(/^runs\/([^/]+)\/(.+)$/i);
    return buildPreviewVideoAssetKeyFromPath(String(match?.[1] || sourceRunId || "").trim(), String(match?.[2] || "").trim());
  }
  try {
    const parsed = new URL(raw, window.location.origin);
    const assetKey = String(parsed.searchParams.get("asset_key") || "").trim();
    if (assetKey) return derivePreviewVideoAssetKey(assetKey, work);
    const pathValue = String(parsed.searchParams.get("path") || "").trim();
    const runMatch = parsed.pathname.match(/\/cssapi\/v1\/runs\/([^/]+)\/music-delivery-artifact/i);
    const runId = String(runMatch?.[1] || sourceRunId || "").trim();
    if (pathValue && runId) return buildPreviewVideoAssetKeyFromPath(runId, pathValue);
  } catch (_err) {
    return "";
  }
  return "";
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
  const previewVideoAssetKey = derivePreviewVideoAssetKey(previewVideoUrl, currentWatchPreviewWork);
  return {
    cover_image: coverImage || null,
    preview_image_url: previewImageUrl || null,
    preview_video_url: previewVideoUrl || null,
    preview_video_asset_key: previewVideoAssetKey || null
  };
}

async function persistWorkAssets(workId, assetPatch = {}) {
  const targetId = String(workId || "").trim();
  if (!authState.user || !targetId) return false;
  const payload = {
    cover_image: String(assetPatch?.cover_image || "").trim() || null,
    preview_image_url: String(assetPatch?.preview_image_url || "").trim() || null,
    preview_video_url: String(assetPatch?.preview_video_url || "").trim() || null,
    preview_video_asset_key: String(assetPatch?.preview_video_asset_key || "").trim() || null
  };
  if (!payload.cover_image && !payload.preview_image_url && !payload.preview_video_url && !payload.preview_video_asset_key) return false;
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
  if (!payload.cover_image && !payload.preview_image_url && !payload.preview_video_url && !payload.preview_video_asset_key) return;
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
  return "";
}

function resolveWorkCardThumbnailImageModule(work = {}) {
  const preferred = [
    work?.small_thumbnail_url,
    work?.thumbnail_url,
    work?.preview_image_url,
    work?.cover_image
  ]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  if (preferred) return preferred;
  const cover = resolveWorkCoverImage(work);
  if (!cover) return "";
  const cache = readWorkSmallThumbCache();
  return String(cache[cover] || cover).trim();
}

function requestImageDataUrlDownscaleModule(sourceUrl = "", size = 240) {
  const safeSource = String(sourceUrl || "").trim();
  if (!safeSource) return Promise.resolve("");
  if (safeSource.startsWith("data:image/")) return Promise.resolve(safeSource);
  return new Promise((resolve) => {
    const image = new Image();
    image.crossOrigin = "anonymous";
    image.decoding = "async";
    image.onload = () => {
      try {
        const width = Number(image.naturalWidth || image.width || 0);
        const height = Number(image.naturalHeight || image.height || 0);
        if (!width || !height) {
          resolve(safeSource);
          return;
        }
        const scale = Math.min(1, size / Math.max(width, height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(width * scale));
        canvas.height = Math.max(1, Math.round(height * scale));
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(safeSource);
          return;
        }
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/webp", 0.82));
      } catch (_err) {
        resolve(safeSource);
      }
    };
    image.onerror = () => resolve(safeSource);
    image.src = safeSource;
  });
}

async function ensureWorkCardThumbnailImageModule(work = {}, options = {}) {
  const source = String(work?.cover_image || work?.preview_image_url || work?.thumbnail_url || "").trim();
  if (!source || source.startsWith("data:image/")) return resolveWorkCardThumbnailImageModule(work);
  const existingThumb = String(work?.small_thumbnail_url || "").trim();
  if (existingThumb) return existingThumb;
  const cache = readWorkSmallThumbCache();
  if (String(cache[source] || "").trim()) {
    return String(cache[source] || "").trim();
  }
  const dataUrl = await requestImageDataUrlDownscaleModule(source, Number(options?.size || 240));
  if (!dataUrl) return source;
  const nextCache = { ...cache, [source]: dataUrl };
  writeWorkSmallThumbCache(nextCache);
  const workId = String(work?.work_id || work?.local_id || work?.id || "").trim();
  if (workId) {
    updateLocalWorkAssets(workId, { small_thumbnail_url: dataUrl });
  }
  return dataUrl;
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
  if (existing && !isSyntheticWorkCoverImage(existing)) return existing;
  return "";
}

function compactLyricLines(lines = []) {
  return (Array.isArray(lines) ? lines : [])
    .map((line) => String(line || "").trim())
    .filter((line) => line && !/^title\s*·/i.test(line) && !/^\[[^\]]+\]$/.test(line));
}
