// CSSMV_CONSOLE_CLEANUP 20260423 #91 — Jing: "祖国江山一片红". Persist the
// "music.plan.json unavailable" verdict across reloads so repeat visits to
// the same runId don't each paint a fresh 404 in the console. 10-min TTL so
// a backend that ships the artifact later self-heals without a cache flush.
const MUSIC_PLAN_SS_DISABLED = "cssos.musicPlan.unavailable.runIds";
const MUSIC_PLAN_TTL_MS = 10 * 60 * 1000;

function musicPlanEndpointDisabled(runId) {
  try {
    if (typeof sessionStorage === "undefined") return false;
    const raw = sessionStorage.getItem(MUSIC_PLAN_SS_DISABLED);
    const map = raw ? JSON.parse(raw) : null;
    if (!map || typeof map !== "object") return false;
    const until = map[runId] ? parseInt(map[runId], 10) : 0;
    if (until && Date.now() < until) return true;
    if (until) {
      delete map[runId];
      sessionStorage.setItem(MUSIC_PLAN_SS_DISABLED, JSON.stringify(map));
    }
  } catch (_err) {}
  return false;
}

function musicPlanTripBreaker(runId) {
  try {
    if (typeof sessionStorage === "undefined") return;
    const raw = sessionStorage.getItem(MUSIC_PLAN_SS_DISABLED);
    const map = raw ? JSON.parse(raw) : {};
    if (!map || typeof map !== "object") return;
    map[runId] = String(Date.now() + MUSIC_PLAN_TTL_MS);
    sessionStorage.setItem(MUSIC_PLAN_SS_DISABLED, JSON.stringify(map));
  } catch (_err) {}
}

async function maybeHydrateWatchMusicPlanModule(runId) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return null;
  if (watchMusicPlanCache.runId !== safeRunId) {
    watchMusicPlanCache.runId = safeRunId;
    watchMusicPlanCache.data = null;
    watchMusicPlanCache.pending = false;
    watchMusicPlanCache.error = "";
    // Rehydrate the "unavailable" verdict from sessionStorage so we skip
    // the fetch entirely on repeat page loads.
    if (musicPlanEndpointDisabled(safeRunId)) {
      watchMusicPlanCache.error = "unavailable";
    }
  }
  if (watchMusicPlanCache.data || watchMusicPlanCache.pending || watchMusicPlanCache.error) {
    return watchMusicPlanCache.data;
  }
  const url = musicPlanArtifactUrl(safeRunId);
  if (!url) return null;
  watchMusicPlanCache.pending = true;
  try {
    const res = await fetch(url, {
      headers: { accept: "application/json" }
    });
    if (!res.ok) {
      if (res.status === 404 || res.status === 501 || res.status === 502 || res.status === 503) {
        musicPlanTripBreaker(safeRunId);
      }
      throw new Error(`music.plan ${res.status}`);
    }
    const payload = await res.json().catch(() => null);
    if (!payload || typeof payload !== "object") {
      throw new Error("music.plan invalid");
    }
    watchMusicPlanCache.data = payload;
    watchMusicPlanCache.error = "";
    maybeRestoreWatchReplyLockedWindow();
    if (watchMusicPlanCache.runId === safeRunId) {
      renderMusicEngineSnapshot(latestWatchMusicStatusPayload, latestWatchMusicSnapshot);
    }
    return payload;
  } catch (_err) {
    watchMusicPlanCache.error = "unavailable";
    return null;
  } finally {
    watchMusicPlanCache.pending = false;
  }
}

async function maybeHydrateWatchKaraokeTimelineModule(runId, statusPayload = null) {
  const safeRunId = String(runId || "").trim();
  if (!safeRunId) return null;
  if (watchKaraokeTimelineCache.runId !== safeRunId) {
    watchKaraokeTimelineCache.runId = safeRunId;
    watchKaraokeTimelineCache.data = null;
    watchKaraokeTimelineCache.pending = false;
    watchKaraokeTimelineCache.error = "";
  }
  if (watchKaraokeTimelineCache.data || watchKaraokeTimelineCache.pending || watchKaraokeTimelineCache.error) {
    return watchKaraokeTimelineCache.data;
  }
  const artifacts = Array.isArray(statusPayload?.artifacts) ? statusPayload.artifacts : [];
  const timelinePaths = ["./build/karaoke.timeline.json", "./build/segment-timeline.json"];
  const buildFallbackTimelineFromSegments = (payload) => {
    const segments = Array.isArray(payload) ? payload : [];
    if (!segments.length) return null;
    const titleSplit = globalThis.splitLyricsTitleAndBodyModule?.(
      String(state?.songSeed?.title || state?.title || "").trim(),
      Array.isArray(state?.lines) ? state.lines : []
    ) || { titleLine: "" };
    const titleLine = String(titleSplit?.titleLine || "").trim();
    const lyricLines = compactLyricLines(Array.isArray(state?.lines) ? state.lines : [])
      .filter(Boolean)
      .filter((line) => String(line || "").trim() !== titleLine);
    const totalEnd = Number(segments[segments.length - 1]?.end_s || segments[segments.length - 1]?.duration_s || 0) || 0;
    if (!lyricLines.length || totalEnd <= 0) {
      return segments
        .map((segment, index) => {
          const start = Number(segment?.start_s || 0);
          const end = Math.max(start + 0.25, Number(segment?.end_s || start + Number(segment?.duration_s || 0) || 0));
          const text = String(segment?.label || segment?.subtitle_text || `Scene ${index + 1}`).trim();
          return text ? { start_s: start, end_s: end, text } : null;
        })
        .filter(Boolean);
    }
    const step = totalEnd / lyricLines.length;
    return lyricLines.map((line, index) => {
      const start = Number((index * step).toFixed(3));
      const end = Number(((index === lyricLines.length - 1 ? totalEnd : (index + 1) * step)).toFixed(3));
      return {
        start_s: start,
        end_s: Math.max(start + 0.25, end),
        text: line
      };
    });
  };
  watchKaraokeTimelineCache.pending = true;
  try {
    let payload = null;
    for (const artifactPath of timelinePaths) {
      const advertised = artifacts.some((entry) => String(entry?.path || "").trim() === artifactPath);
      // CSSMV_CONSOLE_CLEANUP 20260423 #91 — Jing: "祖国江山一片红".
      // Skip the network round-trip (and the browser's red 404 log) when the
      // run's own status payload doesn't advertise this artifact path.
      // Previously we always fetched and used `advertised` only to decide
      // whether to continue the loop after a non-OK response; that painted
      // the console red for every run that shipped a segment-timeline but
      // no karaoke.timeline (or vice versa). If nothing is advertised, fall
      // back to the segment-derived timeline below instead of poking every
      // path blindly.
      if (!advertised) continue;
      const url = finalAudioArtifactUrl(safeRunId, artifactPath);
      if (!url) continue;
      const res = await fetch(url, {
        cache: "no-store",
        headers: { accept: "application/json" }
      });
      if (!res.ok) {
        continue;
      }
      const raw = await res.json().catch(() => null);
      if (Array.isArray(raw) && artifactPath.endsWith("karaoke.timeline.json")) {
        payload = raw;
        break;
      }
      if (Array.isArray(raw) && artifactPath.endsWith("segment-timeline.json")) {
        payload = buildFallbackTimelineFromSegments(raw);
        if (Array.isArray(payload) && payload.length) break;
      }
    }
    if (!Array.isArray(payload) || !payload.length) {
      throw new Error("karaoke.timeline unavailable");
    }
    watchKaraokeTimelineCache.data = payload;
    watchKaraokeTimelineCache.error = "";
    if (watchKaraokeTimelineCache.runId === safeRunId) {
      globalThis.renderWatchKaraokeOverlayModule?.();
    }
    return payload;
  } catch (_err) {
    watchKaraokeTimelineCache.error = "unavailable";
    return null;
  } finally {
    watchKaraokeTimelineCache.pending = false;
  }
}

function containsCjkTextModule(input) {
  return /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(String(input || ""));
}

function splitDisplayTitleLinesModule(input) {
  const raw = String(input || "").replace(/\s+/g, " ").trim();
  if (!raw) {
    return {
      primary: "CSS MV",
      secondary: "",
      primaryIsCjk: false,
      secondaryIsCjk: false
    };
  }
  const explicitParts = raw
    .split(/\r?\n|[|｜/]/)
    .map((part) => String(part || "").trim())
    .filter(Boolean);
  if (explicitParts.length >= 2) {
    const primary = explicitParts[0];
    const secondary = explicitParts.slice(1).join(" · ");
    return {
      primary,
      secondary,
      primaryIsCjk: containsCjkTextModule(primary),
      secondaryIsCjk: containsCjkTextModule(secondary)
    };
  }
  const hasLatin = /[A-Za-z]/.test(raw);
  const hasCjk = containsCjkTextModule(raw);
  if (hasLatin && hasCjk) {
    const primary = raw
      .replace(/[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\s·\-–—,:;|/]+|[\s·\-–—,:;|/]+$/g, "");
    const secondary = raw
      .replace(/[A-Za-z0-9&'’".,:;!?()\-–—/ ]+/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/^[\s·\-–—,:;|/]+|[\s·\-–—,:;|/]+$/g, "");
    if (primary && secondary) {
      return {
        primary,
        secondary,
        primaryIsCjk: false,
        secondaryIsCjk: true
      };
    }
  }
  return {
    primary: raw,
    secondary: "",
    primaryIsCjk: hasCjk,
    secondaryIsCjk: false
  };
}

function titleFontSizeModule(lines = [], baseSize = 72, minSize = 34) {
  const longest = Math.max(
    1,
    ...lines
      .map((line) => String(line || "").trim())
      .filter(Boolean)
      .map((line) => line.length)
  );
  if (longest <= 10) return baseSize;
  if (longest <= 16) return Math.max(minSize, baseSize - 10);
  if (longest <= 24) return Math.max(minSize, baseSize - 18);
  if (longest <= 34) return Math.max(minSize, baseSize - 26);
  return minSize;
}

function titleLineMarkupModule(title, options = {}) {
  const safe = splitDisplayTitleLinesModule(title);
  const lines = [safe.primary, safe.secondary].filter(Boolean);
  const titlePresets = {
    cinema: {
      fill: "#f7fff9",
      stroke: "rgba(1,8,6,0.84)",
      strokeWidth: 1.3,
      letterSpacing: 6,
      primaryScale: 1,
      secondaryScale: 0.82
    },
    dream: {
      fill: "#fff5ea",
      stroke: "rgba(8, 10, 20, 0.88)",
      strokeWidth: 1.5,
      letterSpacing: 4,
      primaryScale: 1.08,
      secondaryScale: 0.86
    },
    neon: {
      fill: "#e8fffb",
      stroke: "rgba(2, 8, 6, 0.9)",
      strokeWidth: 1.1,
      letterSpacing: 8,
      primaryScale: 1,
      secondaryScale: 0.8
    }
  };
  const presetKey = String(options.stylePreset || "cinema").trim().toLowerCase();
  const preset = titlePresets[presetKey] || titlePresets.cinema;
  const size = titleFontSizeModule(lines, Number(options.baseSize || 72), Number(options.minSize || 34));
  const lineGap = Number(options.lineGap || Math.round(size * 0.98));
  const anchorX = options.anchorX ?? "50%";
  const centerY = Number(options.centerY ?? 350);
  const textAnchor = options.textAnchor || "middle";
  const align = options.align || "center";
  const layoutSeed = Number(options.layoutSeed || 0);
  const layoutVariants = ["stacked", "offset", "cascade", "spotlight"];
  const layoutVariant = layoutVariants[Math.abs(layoutSeed) % layoutVariants.length] || "stacked";
  const buildFontPool = (isCjk) => {
    const manifest = Array.isArray(globalThis.CSSOS_WATCH_FONT_MANIFEST)
      ? globalThis.CSSOS_WATCH_FONT_MANIFEST
      : [];
    const dynamicFamilies = manifest
      .filter((entry) => {
        const family = String(entry?.family || "").trim();
        const src = String(entry?.src || "").trim();
        if (!family) return false;
        const looksCjk =
          /[\u3400-\u9fff\u3040-\u30ff\uac00-\ud7af]/.test(family) ||
          src.startsWith("fonts/");
        return isCjk ? looksCjk : !looksCjk;
      })
      .map((entry) => `"${String(entry.family || "").trim().replace(/"/g, '\\"')}"`);
    const fallbackFamilies = isCjk
      ? presetKey === "dream"
        ? [`"Source Han Serif SC"`, `"Songti SC"`, `"STSong"`, `"PingFang SC"`]
        : [`"HengShanMaoBiCaoShu"`, `"PingFang SC"`, `"Hiragino Sans GB"`, `"Microsoft YaHei"`]
      : presetKey === "dream"
        ? [`"CSSTitleBoldB"`, `"Cormorant Garamond"`, `"Bodoni Moda"`, `"Playfair Display"`]
        : presetKey === "neon"
          ? [`"CSSTitleBoldA"`, `"Monument Extended"`, `"Orbitron"`, `"Space Grotesk"`]
          : [`"CSSTitleBoldC"`, `"Syne"`, `"Space Grotesk"`];
    return [...new Set([...dynamicFamilies, ...fallbackFamilies])];
  };
  const pickSeeded = (items = [], salt = 0) => {
    const list = Array.isArray(items) ? items.filter(Boolean) : [];
    if (!list.length) return "";
    const seedBase = Math.abs(Math.sin((layoutSeed + 1 + salt) * 12.9898) * 43758.5453);
    return list[Math.floor(seedBase % list.length)] || list[0];
  };
  const buildFont = (isCjk, salt = 0) => `${pickSeeded(buildFontPool(isCjk), salt)}, ${isCjk ? "serif" : "sans-serif"}`;
  const textStyle = (fontFamily, fontSize, opacity = 1) =>
    `font-family:${fontFamily};font-size:${fontSize}px;fill:${options.fill || preset.fill};letter-spacing:${options.letterSpacing || preset.letterSpacing};opacity:${opacity};paint-order:stroke fill;stroke:${options.stroke || preset.stroke};stroke-width:${options.strokeWidth || preset.strokeWidth};`;
  const fragmentize = (value = "") => {
    const raw = String(value || "").trim();
    if (!raw) return [];
    if (containsCjkTextModule(raw)) {
      return raw.split("").filter(Boolean);
    }
    return raw.split(/\s+/).filter(Boolean);
  };
  const chunkFragmentsSequentially = (fragments = [], rowCount = 1) => {
    const list = Array.isArray(fragments) ? fragments.filter(Boolean) : [];
    const rows = Math.max(1, Math.min(Number(rowCount || 1) || 1, list.length || 1));
    if (!list.length) return [];
    if (rows === 1) return [list];
    const result = [];
    let cursor = 0;
    for (let rowIndex = 0; rowIndex < rows; rowIndex += 1) {
      const remainingRows = rows - rowIndex;
      const remainingItems = list.length - cursor;
      const sliceSize = Math.max(1, Math.ceil(remainingItems / remainingRows));
      result.push(list.slice(cursor, cursor + sliceSize));
      cursor += sliceSize;
    }
    return result.filter((row) => row.length);
  };
  const renderFragments = (value, {
    x = anchorX,
    y = centerY,
    fontFamily,
    fontSize,
    opacity = 1,
    alignMode = textAnchor,
    colorSet = [],
    variant = layoutVariant,
  } = {}) => {
    const fragments = fragmentize(value);
    if (fragments.length <= 1) {
      return `<text x="${x}" y="${y}" text-anchor="${alignMode}" style="${textStyle(fontFamily, fontSize, opacity)}">${escapeHtml(String(value || ""))}</text>`;
    }
    const startX = Number(typeof x === "number" ? x : 640);
    const palette = Array.isArray(colorSet) && colorSet.length
      ? colorSet
      : [options.fill || preset.fill, "#dffef4", "#9fead1", "#fff5ea"];
    const rowCount =
      fragments.length >= 10 ? 3 :
      fragments.length >= 5 ? 2 :
      1;
    const rows = chunkFragmentsSequentially(fragments, rowCount);
    return rows.map((rowFragments, rowIndex) => {
      const offsetY =
        rowIndex * Math.max(18, Math.round(fontSize * 0.44)) +
        (variant === "cascade" ? rowIndex * Math.max(8, Math.round(fontSize * 0.16)) : 0);
      const rowOffsetX =
        variant === "offset" ? (rowIndex % 2 === 0 ? -18 : 14) :
        variant === "cascade" ? (rowIndex - (rows.length - 1) / 2) * 16 :
        variant === "spotlight" ? (rowIndex - (rows.length - 1) / 2) * 8 :
        0;
      const pulseBegin = ((Math.abs(layoutSeed) + rowIndex * 7) % 9) / 3;
      const pulseOpacity = Math.max(0.42, Math.min(1, opacity - rowIndex * 0.08));
      const pulseValues =
        rowIndex % 2 === 0
          ? `${pulseOpacity};1;${Math.max(0.35, pulseOpacity - 0.18)};1`
          : `${Math.max(0.45, pulseOpacity - 0.12)};0.94;${pulseOpacity};1`;
      const spacing = containsCjkTextModule(rowFragments.join("")) ? "" : " ";
      const rowText = rowFragments.join(spacing);
      const fragmentColor = palette[rowIndex % palette.length];
      const rowFont = buildFont(containsCjkTextModule(rowText), rowIndex + rowFragments.length);
      const sizeJitter =
        variant === "spotlight" ? (rowIndex % 2 === 0 ? 1.15 : 0.92) :
        variant === "offset" ? (rowIndex % 2 === 0 ? 1.08 : 0.96) :
        variant === "cascade" ? (rowIndex === 0 ? 1.08 : 0.92) :
        1;
      return `<text x="${startX + rowOffsetX}" y="${y + offsetY}" text-anchor="${alignMode}" style="${textStyle(rowFont || fontFamily, Math.max(24, Math.round(fontSize * sizeJitter)), pulseOpacity).replace(`fill:${options.fill || preset.fill};`, `fill:${fragmentColor};`)}">${escapeHtml(rowText)}<animate attributeName="opacity" values="${pulseValues}" dur="6.4s" begin="${pulseBegin}s" repeatCount="indefinite" /></text>`;
    }).join("");
  };
  if (lines.length === 1) {
    return renderFragments(lines[0], {
      x: anchorX,
      y: centerY,
      fontFamily: buildFont(safe.primaryIsCjk),
      fontSize: Math.round(size * preset.primaryScale),
      opacity: 1,
      alignMode: textAnchor,
      colorSet: [options.fill || preset.fill, "#f7fff9", "#dffef4", "#fff5ea"],
    });
  }
  const startY = centerY - lineGap / 2;
  const first = renderFragments(lines[0], {
    x: anchorX,
    y: startY,
    fontFamily: buildFont(safe.primaryIsCjk),
    fontSize: Math.round(size * preset.primaryScale),
    opacity: 0.98,
    alignMode: textAnchor,
    colorSet: [options.fill || preset.fill, "#f7fff9", "#dffef4"],
    variant: layoutVariant,
  });
  const second = renderFragments(lines[1], {
    x: anchorX,
    y: startY + lineGap,
    fontFamily: buildFont(safe.secondaryIsCjk),
    fontSize: Math.max(Math.round(size * preset.secondaryScale), options.minSize || 34),
    opacity: 0.96,
    alignMode: textAnchor,
    colorSet: [options.fill || preset.fill, "#9fead1", "#fff5ea"],
    variant: layoutVariant === "spotlight" ? "offset" : layoutVariant,
  });
  return `<g data-title-align="${align}">${first}${second}</g>`;
}

function buildLocalVideoPreviewSvgModule(title, subtitle, options = {}) {
  const safeSubtitle = String(subtitle || "Local preview").replace(/</g, "&lt;");
  const titleLines = splitDisplayTitleLinesModule(title || "CSS MV");
  const titleMarkup = titleLineMarkupModule(title || "CSS MV", {
    baseSize: 72,
    minSize: 38,
    centerY: 350,
    fill: "#eafff6",
    stroke: "rgba(2, 10, 7, 0.82)",
    stylePreset: options?.titleStylePreset || "cinema"
  });
  const subtitleY = titleLines.secondary ? "63%" : "56%";
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="g" cx="50%" cy="45%" r="60%">
      <stop offset="0%" stop-color="#00f5a0" stop-opacity="0.9"/>
      <stop offset="60%" stop-color="#0b6f55" stop-opacity="0.6"/>
      <stop offset="100%" stop-color="#020302" stop-opacity="0.95"/>
    </radialGradient>
    <filter id="blur">
      <feGaussianBlur stdDeviation="8"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="#020302"/>
  <circle cx="620" cy="360" r="280" fill="url(#g)"/>
  <circle cx="680" cy="320" r="220" fill="url(#g)" opacity="0.6" filter="url(#blur)"/>
  ${titleMarkup}
  <text x="50%" y="${subtitleY}" text-anchor="middle" font-family="Space Grotesk, sans-serif" font-size="28" fill="#9fead1" letter-spacing="6">${safeSubtitle}</text>
</svg>`
    )
  );
}

function buildCreativeStagePreviewSvgModule(title, subtitle, stage = "opening", options = {}) {
  const safeSubtitle = String(subtitle || "Improvising").replace(/</g, "&lt;");
  const key = String(stage || "opening").trim().toLowerCase();
  const configs = {
    opening: {
      start: "#08211d",
      mid: "#167a68",
      end: "#020302",
      glowA: "#b7fff0",
      glowB: "#5ff0c8",
      accent: "#f7fff9",
      shapes: `
        <circle cx="642" cy="342" r="210" fill="url(#coreGlow)" opacity="0.72"/>
        <ellipse cx="640" cy="418" rx="320" ry="124" fill="#03201b" opacity="0.82"/>
        <rect x="612" y="256" width="56" height="220" rx="28" fill="#f3fff9" opacity="0.12"/>
        <circle cx="640" cy="252" r="42" fill="#f3fff9" opacity="0.15"/>
        <path d="M266 512 C396 458, 492 442, 586 448" stroke="#d7fff2" stroke-opacity="0.16" stroke-width="5" fill="none"/>
      `
    },
    chorus: {
      start: "#201006",
      mid: "#c66827",
      end: "#120403",
      glowA: "#ffe2b0",
      glowB: "#ff9560",
      accent: "#fff6eb",
      shapes: `
        <circle cx="520" cy="308" r="168" fill="url(#coreGlow)" opacity="0.62"/>
        <circle cx="760" cy="308" r="168" fill="url(#coreGlow)" opacity="0.62"/>
        <path d="M320 450 C486 344, 794 344, 960 450" stroke="#fff2cf" stroke-opacity="0.22" stroke-width="7" fill="none"/>
        <circle cx="432" cy="458" r="30" fill="#fff4e8" opacity="0.14"/>
        <circle cx="532" cy="486" r="26" fill="#fff4e8" opacity="0.14"/>
        <circle cx="640" cy="500" r="34" fill="#fff4e8" opacity="0.16"/>
        <circle cx="748" cy="486" r="26" fill="#fff4e8" opacity="0.14"/>
        <circle cx="848" cy="458" r="30" fill="#fff4e8" opacity="0.14"/>
      `
    },
    callback: {
      start: "#07132b",
      mid: "#4767d7",
      end: "#03050b",
      glowA: "#dce7ff",
      glowB: "#88a8ff",
      accent: "#f4f7ff",
      shapes: `
        <circle cx="640" cy="336" r="194" fill="url(#coreGlow)" opacity="0.7"/>
        <circle cx="640" cy="336" r="88" fill="#edf3ff" opacity="0.12"/>
        <path d="M240 490 C380 438, 484 420, 640 420 C796 420, 900 438, 1040 490" stroke="#eff5ff" stroke-opacity="0.2" stroke-width="6" fill="none"/>
        <circle cx="380" cy="498" r="24" fill="#eff5ff" opacity="0.12"/>
        <circle cx="460" cy="470" r="20" fill="#eff5ff" opacity="0.12"/>
        <circle cx="820" cy="470" r="20" fill="#eff5ff" opacity="0.12"/>
        <circle cx="900" cy="498" r="24" fill="#eff5ff" opacity="0.12"/>
        <rect x="620" y="250" width="40" height="178" rx="20" fill="#f4f7ff" opacity="0.16"/>
        <circle cx="640" cy="230" r="32" fill="#f4f7ff" opacity="0.16"/>
      `
    }
  };
  const config = configs[key] || configs.opening;
  const titleMarkup = titleLineMarkupModule(title || "CSS MV", {
    baseSize: 66,
    minSize: 34,
    centerY: 590,
    anchorX: 72,
    textAnchor: "start",
    align: "left",
    fill: config.accent,
    stroke: "rgba(2, 6, 5, 0.82)",
    stylePreset: options?.titleStylePreset || (key === "callback" ? "dream" : "neon")
  });
  return (
    "data:image/svg+xml;utf8," +
    encodeURIComponent(
      `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720" viewBox="0 0 1280 720">
  <defs>
    <radialGradient id="bgGlow" cx="50%" cy="42%" r="68%">
      <stop offset="0%" stop-color="${config.mid}" stop-opacity="0.92"/>
      <stop offset="62%" stop-color="${config.start}" stop-opacity="0.76"/>
      <stop offset="100%" stop-color="${config.end}" stop-opacity="0.98"/>
    </radialGradient>
    <radialGradient id="coreGlow" cx="50%" cy="46%" r="52%">
      <stop offset="0%" stop-color="${config.glowA}" stop-opacity="0.92"/>
      <stop offset="58%" stop-color="${config.glowB}" stop-opacity="0.52"/>
      <stop offset="100%" stop-color="${config.end}" stop-opacity="0"/>
    </radialGradient>
    <filter id="blurStage">
      <feGaussianBlur stdDeviation="9"/>
    </filter>
  </defs>
  <rect width="1280" height="720" fill="${config.end}"/>
  <rect width="1280" height="720" fill="url(#bgGlow)"/>
  <ellipse cx="640" cy="620" rx="560" ry="186" fill="#010101" opacity="0.34" filter="url(#blurStage)"/>
  ${config.shapes}
  <text x="72" y="102" font-family="Syne, sans-serif" font-size="26" fill="${config.accent}" opacity="0.78" letter-spacing="6">${safeSubtitle}</text>
  ${titleMarkup}
</svg>`
    )
  );
}

window.maybeHydrateWatchKaraokeTimelineModule = maybeHydrateWatchKaraokeTimelineModule;

window.maybeHydrateWatchMusicPlanModule = maybeHydrateWatchMusicPlanModule;
window.buildLocalVideoPreviewSvgModule = buildLocalVideoPreviewSvgModule;
window.buildCreativeStagePreviewSvgModule = buildCreativeStagePreviewSvgModule;
window.splitDisplayTitleLinesModule = splitDisplayTitleLinesModule;
window.titleLineMarkupModule = titleLineMarkupModule;
