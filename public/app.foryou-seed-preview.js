function applySongSeedToSettings(seed) {
  return globalThis.applySongSeedToSettingsModule?.(seed);
}

const localSeedTabButtons = globalThis.seedTabButtons || document.querySelectorAll("[data-seed-tab]");
const localLyricsInputTabButtons =
  globalThis.lyricsInputTabButtons || document.querySelectorAll("[data-lyrics-input-tab]");
const localSeedPaneMusic = globalThis.seedPaneMusic || document.getElementById("seed-pane-music");
const localSeedPaneOutline = globalThis.seedPaneOutline || document.getElementById("seed-pane-outline");
const localSeedPaneScenes = globalThis.seedPaneScenes || document.getElementById("seed-pane-scenes");
const localLyricsInputPaneEditor =
  globalThis.lyricsInputPaneEditor || document.getElementById("lyrics-input-pane-editor");
const localLyricsInputPaneUploads =
  globalThis.lyricsInputPaneUploads || document.getElementById("lyrics-input-pane-uploads");

function activateSeedTab(tab) {
  const active = ["music", "outline", "scenes"].includes(tab) ? tab : "music";
  localSeedTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.seedTab === active);
  });
  localSeedPaneMusic?.classList.toggle("active", active === "music");
  localSeedPaneOutline?.classList.toggle("active", active === "outline");
  localSeedPaneScenes?.classList.toggle("active", active === "scenes");
}

function activateLyricsInputTab(tab) {
  const active = tab === "uploads" ? "uploads" : "editor";
  localLyricsInputTabButtons.forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.lyricsInputTab === active);
  });
  localLyricsInputPaneEditor?.classList.toggle("active", active === "editor");
  localLyricsInputPaneUploads?.classList.toggle("active", active === "uploads");
}

globalThis.activateSeedTab = activateSeedTab;
globalThis.activateLyricsInputTab = activateLyricsInputTab;

async function requestForyouThumbnail(title, subtitle, lines = []) {
  try {
    const pool =
      (await globalThis.requestThumbnailVariantPool?.(title, subtitle, lines, {
        count: 5,
      })) || [];
    const leadImage =
      String(pool[0] || "").trim() ||
      (await requestThumbnailDataUrl(title, subtitle, lines));
    const cardImage = String(pool[3] || pool[4] || leadImage || "").trim();
    if (!leadImage && !cardImage) return false;
    if (cardImage) setForyouThumbImage(cardImage);
    if (leadImage && !String(globalThis.currentPreviewFrameDataUrl || "").trim()) {
      globalThis.currentPreviewFrameDataUrl = leadImage;
    }
    if (pool.length) {
      // W347 20260523 — Jing: 若 armAutoEnjoyModule 刚刚把池锁到最新作品单张封面
      // (< 20s 前), 就不要用 AI 缩略图覆盖它 → 防止乱闪重现.
      const _lockedAge = Date.now() - (globalThis.__cssosWatchArtworkPoolLockedMs || 0);
      if (_lockedAge > 20000) {
        // W348 20260523 — Jing: replicate.delivery URL 过期极快 → img-thumb 502.
        // 改为存 /api/img-thumb?u=<url>&w=800 代理 URL: img-thumb 在首次成功取图时
        // 缓存到本地磁盘, 即使原 replicate URL 之后过期, 代理依然从缓存出图.
        const _toProxied = (u) => {
          const s = String(u || "").trim();
          if (!s || s.startsWith("/api/img-thumb")) return s;
          if (/^data:/.test(s)) return s; // keep data-URLs as-is
          return "/api/img-thumb?u=" + encodeURIComponent(s) + "&w=800";
        };
        const _proxied = pool.slice(0, 5).map(_toProxied).filter(Boolean);
        globalThis.currentWatchArtworkVariantPool = _proxied;
        // 立即触发 img-thumb 缓存预热(fire-and-forget)
        _proxied.forEach((u) => { try { fetch(u, { method: "HEAD" }).catch(() => {}); } catch (_e) {} });
      }
    }
    globalThis.cacheWatchFrameModule?.(leadImage || cardImage);
    globalThis.showWatchFramePlaceholderModule?.(leadImage || cardImage);
    globalThis.syncWatchMusicArtworkModule?.();
    syncWatchPlaceholderAfterForyouThumbModule();
    return true;
  } catch (_err) {
    return false;
  }
}

const workThumbInflight = globalThis.workThumbInflight || (globalThis.workThumbInflight = new Map());
const workThumbVariantPoolCache =
  globalThis.workThumbVariantPoolCache || (globalThis.workThumbVariantPoolCache = new Map());
const workThumbVariantPoolInflight =
  globalThis.workThumbVariantPoolInflight || (globalThis.workThumbVariantPoolInflight = new Map());

function buildThumbnailVisualDirective(lines = []) {
  const sectionPromptLead = Array.isArray(state?.songSeed?.sectionPrompts)
    ? state.songSeed.sectionPrompts
        .slice(0, 3)
        .map((item) => String(item?.prompt || "").trim())
        .filter(Boolean)
        .join(" | ")
    : "";
  return [
    String(creationState?.prompt || "").trim(),
    String(state?.songSeed?.videoOutline || state?.songSeed?.video_outline || "").trim(),
    sectionPromptLead,
    ...(Array.isArray(lines) ? lines.slice(0, 4) : []).map((line) => String(line || "").trim()),
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1200);
}

function buildThumbnailVariantDescriptors(title, subtitle, lines = []) {
  const safeTitle = String(title || "").trim();
  const safeSubtitle = String(subtitle || "").trim();
  const cleanedLines = Array.isArray(lines)
    ? lines
        .map((line) => String(line || "").trim())
        .filter((line) => line && !/^\[[^\]]+\]$/.test(line))
    : [];
  const lineA = cleanedLines[0] || "";
  const lineB = cleanedLines[1] || "";
  const lineC = cleanedLines[2] || "";
  return [
    {
      variantKey: "mv-cover",
      subtitle: safeSubtitle || lineA || safeTitle,
      visualHint:
        "hero key art, elegant focal portrait, theatrical cover frame, premium cinematic poster, stay inside one coherent cultural world for this title",
    },
    {
      variantKey: "music-backdrop",
      subtitle: lineA || safeSubtitle || safeTitle,
      visualHint:
        "wide atmospheric composition, softer depth layers, environment-led music backdrop, graceful negative space, same cultural setting as the main cover",
    },
    {
      variantKey: "music-disc",
      subtitle: lineB || lineA || safeSubtitle || safeTitle,
      visualHint:
        "center-weighted subject, circular crop friendly, iconic silhouette, collector disc illustration, same cultural setting as the main cover",
    },
    {
      variantKey: "foryou-card",
      subtitle: lineC || safeSubtitle || safeTitle,
      visualHint:
        "storefront thumbnail, strong subject separation, luminous luxury, highly clickable discovery card, same cultural setting as the main cover",
    },
    {
      variantKey: "works-card",
      subtitle: safeSubtitle || lineB || safeTitle,
      visualHint:
        "editorial gallery thumbnail, refined premium portrait, collectible work-card still, polished resale appeal, same cultural setting as the main cover",
    },
  ];
}

async function requestThumbnailDataUrl(title, subtitle, lines = [], options = {}) {
  const safeTitle = String(title || "").trim();
  const safeSubtitle = String(subtitle || "").trim();
  const normalizedLines = Array.isArray(lines) ? lines.slice(0, 8).map((line) => String(line || "").trim()) : [];
  const variantKey = String(options?.variantKey || "base").trim();
  const visualHint = String(options?.visualHint || "").trim();
  const visualDirective = [
    buildThumbnailVisualDirective(normalizedLines),
    visualHint,
  ]
    .filter(Boolean)
    .join(" | ")
    .slice(0, 1400);
  const cacheKey = JSON.stringify([
    safeTitle,
    safeSubtitle,
    normalizedLines,
    visualDirective,
    variantKey,
  ]);
  if (workThumbCache.has(cacheKey)) return workThumbCache.get(cacheKey);
  if (workThumbInflight.has(cacheKey)) return workThumbInflight.get(cacheKey);
  const request = (async () => {
    const res = await fetch("/api/cssmv/thumbnail", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        title: safeTitle,
        subtitle: safeSubtitle,
        lyrics: normalizedLines,
        visual_directive: visualDirective,
        output_format: FORYOU_THUMB_OUTPUT_FORMAT,
        output_compression: FORYOU_THUMB_OUTPUT_COMPRESSION,
        background: FORYOU_THUMB_BACKGROUND
      })
    });
    if (!res.ok) return "";
    const raw = await res.json();
    const data = getApiData(raw);
    const image = String(data?.image_data_url || data?.image_url || "").trim();
    if (image) {
      workThumbCache.set(cacheKey, image);
      if (workThumbCache.size > 48) {
        const oldestKey = workThumbCache.keys().next().value;
        if (oldestKey) workThumbCache.delete(oldestKey);
      }
    }
    return image || "";
  })().catch(() => "").finally(() => {
    workThumbInflight.delete(cacheKey);
  });
  workThumbInflight.set(cacheKey, request);
  return request;
}

async function requestThumbnailVariantPool(title, subtitle, lines = [], options = {}) {
  const safeTitle = String(title || "").trim();
  const safeSubtitle = String(subtitle || "").trim();
  const normalizedLines = Array.isArray(lines)
    ? lines.slice(0, 8).map((line) => String(line || "").trim()).filter(Boolean)
    : [];
  const desiredCount = Math.max(1, Math.min(Number(options?.count || 5) || 5, 5));
  const signature = JSON.stringify([
    safeTitle,
    safeSubtitle,
    normalizedLines,
    buildThumbnailVisualDirective(normalizedLines),
    desiredCount,
  ]);
  if (workThumbVariantPoolCache.has(signature)) {
    return workThumbVariantPoolCache.get(signature);
  }
  if (workThumbVariantPoolInflight.has(signature)) {
    return workThumbVariantPoolInflight.get(signature);
  }
  const plan = buildThumbnailVariantDescriptors(safeTitle, safeSubtitle, normalizedLines).slice(0, desiredCount);
  const request = Promise.all(
    plan.map((item) =>
      requestThumbnailDataUrl(safeTitle, item.subtitle, normalizedLines, {
        variantKey: item.variantKey,
        visualHint: item.visualHint,
      }).catch(() => "")
    )
  )
    .then((images) => {
      const unique = [...new Set(images.map((item) => String(item || "").trim()).filter(Boolean))].slice(0, desiredCount);
      if (unique.length) {
        workThumbVariantPoolCache.set(signature, unique);
        if (workThumbVariantPoolCache.size > 16) {
          const oldestKey = workThumbVariantPoolCache.keys().next().value;
          if (oldestKey) workThumbVariantPoolCache.delete(oldestKey);
        }
      }
      return unique;
    })
    .catch(() => [])
    .finally(() => {
      workThumbVariantPoolInflight.delete(signature);
    });
  workThumbVariantPoolInflight.set(signature, request);
  return request;
}

globalThis.requestThumbnailDataUrl = requestThumbnailDataUrl;
globalThis.requestThumbnailVariantPool = requestThumbnailVariantPool;
globalThis.requestForyouThumbnail = requestForyouThumbnail;

function setForyouThumbVideo(uri) {
  if (!foryouThumbVideo || !uri) return false;
  foryouThumbVideo.src = uri;
  foryouThumbVideo.muted = true;
  foryouThumbVideo.playsInline = true;
  foryouThumbVideo.load?.();
  foryouThumbVideo.play?.().catch(() => {});
  syncForyouThumbFallback("video");
  return true;
}

function hasEffectivePreviewVideo() {
  if (!watchVideo?.src || watchVideo.style.display === "none") return false;
  if (currentPreviewVideoIsLocalFallback) return false;
  const duration =
    Number.isFinite(globalThis.currentPreviewVideoDurationSec) && globalThis.currentPreviewVideoDurationSec > 0
      ? globalThis.currentPreviewVideoDurationSec
      : lastRequestedVideoDurationSec;
  return duration > MIN_EFFECTIVE_PREVIEW_DURATION_SEC;
}
