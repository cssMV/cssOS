function setButtonBusyModule(button, busy) {
  if (!(button instanceof HTMLButtonElement)) return;
  button.disabled = !!busy;
  button.classList.toggle("is-busy", !!busy);
}

function setLyricsDebugStatusModule(message, state = "idle") {
  if (!lyricsDebugStatus) return;
  lyricsDebugStatus.textContent = String(message || "").trim();
  lyricsDebugStatus.dataset.state = state;
  lyricsDebugStatus.hidden =
    !message || state === "idle" || state === "success";
}

function getSongSeedTitleContextModule() {
  const expandedTitleText =
    typeof foryouExpandedTitle !== "undefined" && foryouExpandedTitle
      ? foryouExpandedTitle.textContent?.trim?.() || ""
      : "";
  const compactTitleText =
    typeof foryouCompactTitle !== "undefined" && foryouCompactTitle
      ? foryouCompactTitle.textContent?.trim?.() || ""
      : "";
  const candidates = [
    titleInput?.value?.trim?.() || "",
    state.songSeed?.title || "",
    state.title || "",
    expandedTitleText,
    compactTitleText,
  ];
  return candidates.find((value) => String(value || "").trim()) || "";
}

function setSongSeedTitleValueModule(value, options = {}) {
  const text = String(value || "").trim();
  if (titleInput) {
    titleInput.value = text;
    titleInput.dataset.userEdited = options.userEdited ? "1" : "0";
  }
  state.title = text;
  return text;
}

function shouldPreserveSongSeedTitleForRefreshModule() {
  return titleInput?.dataset?.userEdited === "1";
}

// CSSOS_SONG_SEED_TRUE_RANDOM 20260420 — Jing: the old client-side title
// generator picked from fixed leads × tails arrays per language (e.g.
// "潮声/潮生" in Chinese, "月影" in Japanese). The user correctly called
// this out as "假随机" — it's deterministic cycling, not true randomness,
// and it anchors OpenAI/Claude's outputs to the same handful of
// character pairs. This client-side fallback is now neutered: it
// returns an empty string so callers fall through to the real LLM path
// (which in turn is constrained only by UI language, not by a fixed
// pool). If the LLM path is unavailable, the downstream code will
// either retry or use a genre-derived placeholder — but we do NOT
// bake a pseudo-template pool back in.
//
// Resolve-language helper (defined in app.creation-language.js) is used
// so the placeholder language reflects the actual UI language rather
// than the hardcoded "zh" that was overriding English/Japanese UIs.
function buildFallbackSongSeedTitleModule() {
  // Force true randomness via the LLM: return empty string so callers
  // that would use this as a starter string instead skip the fallback.
  // IMPORTANT: we deliberately do not ship a template pool here.
  // Downstream: if a caller absolutely needs a non-empty string
  // synchronously, it will supply its own placeholder from UI context.
  return "";
}

function hasRecentAutoSongSeedTitleModule(title) {
  const value = String(title || "").trim();
  return !!value && recentAutoSongSeedTitles.includes(value);
}

function recordRecentAutoSongSeedTitleModule(title) {
  const value = String(title || "").trim();
  if (!value) return;
  const next = [
    value,
    ...recentAutoSongSeedTitles.filter((item) => item !== value),
  ].slice(0, 16);
  recentAutoSongSeedTitles.splice(0, recentAutoSongSeedTitles.length, ...next);
}

function renderSectionPromptsTextModule(sectionPrompts = []) {
  if (!Array.isArray(sectionPrompts) || !sectionPrompts.length) return "";
  return sectionPrompts
    .map((item) => {
      const section = String(item?.section || "").trim();
      const title = String(item?.title || "").trim();
      const prompt = String(item?.prompt || "").trim();
      return [section || "[Section]", title ? `Title: ${title}` : "", prompt]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function renderSectionBeatsTextModule(sectionBeats = []) {
  if (!Array.isArray(sectionBeats) || !sectionBeats.length) return "";
  return sectionBeats
    .map((item) => {
      const section = String(item?.section || "").trim();
      const title = String(item?.title || "").trim();
      const bars = Number.parseInt(String(item?.bars || "0"), 10) || 0;
      const energy = String(item?.energy || "").trim();
      const focus = String(item?.focus || "").trim();
      const visualRole = String(item?.visual_role || "").trim();
      return [
        section || "[Section]",
        title ? `Title: ${title}` : "",
        bars ? `Bars: ${bars}` : "",
        energy ? `Energy: ${energy}` : "",
        focus ? `Focus: ${focus}` : "",
        visualRole ? `Visual Role: ${visualRole}` : "",
      ]
        .filter(Boolean)
        .join("\n");
    })
    .join("\n\n");
}

function getApiDataModule(payload) {
  if (!payload || typeof payload !== "object") return {};
  return payload.data && typeof payload.data === "object"
    ? payload.data
    : payload;
}

function normalizeSongSeedModule(seed) {
  const data = seed?.data || seed || {};
  const rawSectionPrompts = Array.isArray(data?.section_prompts)
    ? data.section_prompts
    : Array.isArray(data?.sectionPrompts)
      ? data.sectionPrompts
      : [];
  const rawSectionBeats = Array.isArray(data?.section_beats)
    ? data.section_beats
    : Array.isArray(data?.sectionBeats)
      ? data.sectionBeats
      : [];
  const fallbackVideoOutline = !String(data?.video_outline || data?.videoOutline || "").trim() && rawSectionPrompts.length
    ? rawSectionPrompts
        .map((item) => {
          const section = String(item?.section || "").trim();
          const title = String(item?.title || "").trim();
          const prompt = String(item?.prompt || "").trim();
          return [section, title, prompt].filter(Boolean).join(" · ");
        })
        .filter(Boolean)
        .join("\n")
    : "";
  const rawWorkType = String(data?.work_type || "").trim();
  const normalizedTitle = String(
    data?.title ||
      globalThis.extractTitleFromVideoOutlineModule?.(
        data?.video_outline || data?.videoOutline || fallbackVideoOutline || ""
      ) ||
      ""
  ).trim();
  const normalizedLyrics =
    globalThis.buildCanonicalLyricsWithTitleModule?.(
      normalizedTitle,
      String(data?.lyrics || "").trim(),
    ) || String(data?.lyrics || "").trim();
  return {
    title: normalizedTitle,
    lyrics: normalizedLyrics,
    musicStyle: String(data?.music_style || data?.musicStyle || "").trim(),
    musicStructure: String(data?.music_structure || data?.musicStructure || "").trim(),
    videoOutline: String(data?.video_outline || data?.videoOutline || fallbackVideoOutline || "").trim(),
    references: Array.isArray(data?.references)
      ? data.references.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    sectionPrompts: rawSectionPrompts,
    sectionBeats: rawSectionBeats,
    structureTree: Array.isArray(data?.structure_tree)
      ? data.structure_tree
      : [],
    structurePlan: normalizeStructurePlanClient(data?.structure_plan),
    styleTags: Array.isArray(data?.style_tags)
      ? data.style_tags.map((x) => String(x || "").trim()).filter(Boolean)
      : [],
    // W360b — pass through seed.language so the person-MV civilization→language
    // routing (civToLanguageModule → "ja"/"ko"/etc.) reaches applySongSeedToSettings.
    // Without this, normalizeSongSeed strips it and creationState.language stays "en".
    language: String(data?.language || "").trim(),
    workType: inferStructuredWorkType(
      String(data?.title || "").trim(),
      rawWorkType || creationState.workType,
    ),
    creativeSummary:
      data?.creative_summary && typeof data.creative_summary === "object"
        ? {
            family: String(data.creative_summary.family || "").trim(),
            civilization: String(
              data.creative_summary.civilization || "",
            ).trim(),
            perspective: String(data.creative_summary.perspective || "").trim(),
            emotion: String(data.creative_summary.emotion || "").trim(),
            structure: String(data.creative_summary.structure || "").trim(),
            languageStyle: String(
              data.creative_summary.language_style || "",
            ).trim(),
            compact: String(data.creative_summary.compact || "").trim(),
          }
        : null,
  };
}

function buildSeedPreviewSummaryModule(seed = state.songSeed) {
  if (!seed) return { compact: "", watch: "" };
  const creativeCompact = String(seed?.creativeSummary?.compact || "").trim();
  const beatLead = Array.isArray(seed.sectionBeats)
    ? seed.sectionBeats
        .slice(0, 3)
        .map((item) => {
          const section = String(item?.section || "").trim();
          const bars = Number.parseInt(String(item?.bars || "0"), 10) || 0;
          const focus = String(item?.focus || "").trim();
          return [section, bars ? `${bars} bars` : "", focus]
            .filter(Boolean)
            .join(" · ");
        })
        .filter(Boolean)
    : [];
  const compact = [creativeCompact, seed.musicStructure, beatLead[0]]
    .filter(Boolean)
    .join(" · ");
  const watch = [
    creativeCompact ? `World: ${creativeCompact}` : "",
    seed.videoOutline,
    ...beatLead,
  ]
    .filter(Boolean)
    .join("\n");
  return { compact, watch };
}

function describeSongSeedUniverseModule(seed = state.songSeed) {
  const summary = seed?.creativeSummary || null;
  if (!summary) return "";
  return [
    summary.civilization,
    summary.perspective,
    summary.emotion,
    summary.structure,
  ]
    .filter(Boolean)
    .join(" · ");
}

function buildLyricsSeedVisualSignatureModule(seed) {
  const normalized = normalizeSongSeedModule(seed);
  const title = String(normalized?.title || "").trim();
  const lines = compactLyricLines(
    String(normalized?.lyrics || "").split("\n"),
  ).slice(0, 3);
  return [title, ...lines].filter(Boolean).join(" || ");
}

function buildSongSeedHierarchyModule(seed = state.songSeed) {
  if (!seed || typeof seed !== "object") return [];
  if (Array.isArray(seed.structureTree) && seed.structureTree.length) {
    return buildHierarchyFromStructureTree(
      seed.structureTree,
      String(seed.lyrics || "").trim(),
      String(seed.title || state.title || "CSS MV").trim(),
      seed.workType || creationState.workType || "single",
    );
  }
  const title =
    String(seed.title || state.title || "CSS MV").trim() || "CSS MV";
  const workType = inferStructuredWorkType(
    title,
    seed.workType || creationState.workType || "single",
  );
  const lyrics = String(seed.lyrics || "").trim();
  const preview = globalThis.formatForyouLyricsDisplayModule?.(lyrics) || lyrics;
  if (workType === "single") return [];
  if (workType === "triptych") {
    const totalParts = Math.max(
      3,
      Number(seed?.structurePlan?.totalParts || 3),
    );
    const parts = buildStructuredSegments(
      lyrics.split("\n"),
      totalParts,
      title,
    ).map((segment, index) => ({
      title: String(
        segment?.title ||
          `${title} · ${loginCopy("Part")} ${index + 1}`,
      ).trim(),
      work_type: "single",
      structure_role: "part",
      sequence_index: index + 1,
      lyrics_text: (Array.isArray(segment?.lines) ? segment.lines : []).join(
        "\n",
      ),
      lyrics_preview: (Array.isArray(segment?.lines) ? segment.lines : [])
        .join("\n"),
      style: (Array.isArray(segment?.lines) ? segment.lines : [])
        .slice(0, 3)
        .join(" / "),
      children: [],
    }));
    return [
      {
        title,
        work_type: "triptych",
        structure_role: "triptych",
        style: preview,
        children: parts,
      },
    ];
  }
  const prompts = Array.isArray(seed.sectionPrompts) ? seed.sectionPrompts : [];
  const estimatedOperaShape =
    globalThis.estimateOperaShapeModule?.(seed, null, title) || {};
  const targetSceneCount = Math.max(
    Number(seed?.structurePlan?.sceneEnd || 0) -
      Number(seed?.structurePlan?.sceneStart || 1) +
      1,
    Number(seed?.structurePlan?.scenesPerBatch || 0),
    Number(seed?.structurePlan?.scenesPerAct || 0),
    Number(estimatedOperaShape?.scenesPerAct || 0),
    prompts.length,
    String(lyrics || "")
      .split(/\n\s*\n+/)
      .map((block) =>
        block
          .split("\n")
          .map((line) => String(line || "").trim())
          .filter(Boolean),
      )
      .filter((lines) => lines.length).length,
    1,
  );
  const sceneSegments = buildStructuredSegments(
    lyrics.split("\n"),
    targetSceneCount,
    title,
  );
  const scenes = sceneSegments.map((segment, index) => {
    const prompt = prompts[index] || {};
    const lines = Array.isArray(segment?.lines) ? segment.lines : [];
    return {
      title: String(
        prompt?.title ||
          segment?.title ||
          `${loginCopy("Scene")} ${index + 1}`,
      ).trim(),
      work_type: "single",
      structure_role: "scene",
      sequence_index: index + 1,
      lyrics_text: lines.join("\n"),
      lyrics_preview: lines.join("\n"),
      style: String(prompt?.prompt || "").trim(),
      children: [],
    };
  });
  const actNumber = Math.max(
    1,
    Number(seed?.structurePlan?.targetActNumber || 1),
  );
  const acts = [
    {
      title: `${title} · ${formatActLabel(actNumber)}`,
      work_type: "opera",
      structure_role: "act",
      sequence_index: actNumber,
      style: loginCopy("Act structure ready"),
      children: scenes,
    },
  ];
  return [
    {
      title,
      work_type: "opera",
      structure_role: "opera",
      style: preview,
      children: acts,
    },
  ];
}

function renderForyouStructureModule(seed = state.songSeed) {
  if (!foryouStructure) return;
  const hierarchy = buildSongSeedHierarchyModule(seed);
  currentForyouHierarchy = hierarchy;
  if (!hierarchy.length) {
    clearForyouStructure();
    return;
  }
  const normalizedType = normalizeWorkTypeClient(
    seed?.workType || creationState.workType || "single",
  );
  const root = hierarchy[0] || null;
  const displayNodes =
    root &&
    ["triptych", "opera"].includes(normalizedType) &&
    Array.isArray(root.children) &&
    root.children.length
      ? root.children
      : hierarchy;
  foryouStructureNodeMap = new Map();
  const annotateNodes = (nodes, trail = []) =>
    (Array.isArray(nodes) ? nodes : []).map((node, index) => {
      const title = String(node?.title || "").trim() || `node_${index + 1}`;
      const role = String(node?.structure_role || node?.work_type || "single")
        .trim()
        .toLowerCase();
      const key = [
        ...trail,
        `${role}:${title}:${Number(node?.sequence_index || index + 1)}`,
      ].join(">");
      const children = annotateNodes(node?.children || [], [
        ...trail,
        `${role}:${title}`,
      ]);
      const annotated = { ...node, foryou_key: key, children };
      foryouStructureNodeMap.set(key, annotated);
      return annotated;
    });
  const annotatedNodes = annotateNodes(displayNodes);
  foryouStructure.innerHTML = renderHierarchyTree(annotatedNodes, "foryou");
  currentForyouLeafKey = "";
  if (foryouSelection) foryouSelection.hidden = true;
  foryouStructure
    .querySelectorAll("[data-foryou-summary]")
    .forEach((summary) => {
      summary.addEventListener("click", (event) => {
        const hasChildren = summary.getAttribute("data-has-children") === "1";
        if (hasChildren) return;
        const key = String(summary.getAttribute("data-node-key") || "").trim();
        const node = foryouStructureNodeMap.get(key);
        const lyricText = String(
          node?.lyrics_text || node?.lyrics_preview || "",
        ).trim();
        if (!node || !lyricText) return;
        event.preventDefault();
        event.stopPropagation();
        currentForyouLeafKey = key;
        if (foryouSelectionKicker) {
          const role = String(
            node?.structure_role || node?.work_type || "single",
          )
            .trim()
            .toLowerCase();
          foryouSelectionKicker.textContent =
            role === "scene"
              ? loginCopy("Scene Lyrics")
              : role === "part"
                ? loginCopy("Triptych Single")
                : loginCopy("Single Lyrics");
        }
        if (foryouSelectionTitle) {
          foryouSelectionTitle.textContent =
            String(node?.title || "").trim() || loginCopy("Untitled");
        }
        if (foryouSelectionLyrics) {
          foryouSelectionLyrics.textContent =
            globalThis.formatForyouLyricsDisplayModule?.(lyricText) ||
            lyricText;
        }
        if (foryouSelection) {
          foryouSelection.hidden = false;
        }
        cancelAutoEnjoy();
        foryouStructure
          .querySelectorAll("[data-foryou-summary]")
          .forEach((item) => {
            item.classList.toggle(
              "is-selected",
              String(item.getAttribute("data-node-key") || "").trim() ===
                currentForyouLeafKey,
            );
          });
        if (watchLyricsEditor) {
          watchLyricsEditor.value =
            globalThis.formatForyouLyricsDisplayModule?.(lyricText) ||
            lyricText;
        }
      });
    });
}

function recordLyricsSeedSnapshotModule(
  seed = state.songSeed,
  title = state.title,
  lines = state.lines,
) {
  if (!seed) return;
  const compactLines = compactLyricLines(lines).slice(0, 8);
  const entry = {
    at: new Date().toISOString(),
    title: String(title || seed?.title || "").trim(),
    seedTag: String(seed?.seedTag || "").trim(),
    family: String(seed?.creativeSummary?.family || "").trim(),
    civilization: String(seed?.creativeSummary?.civilization || "").trim(),
    perspective: String(seed?.creativeSummary?.perspective || "").trim(),
    emotion: String(seed?.creativeSummary?.emotion || "").trim(),
    firstLine: String(compactLines[0] || "").trim(),
    secondLine: String(compactLines[1] || "").trim(),
    lineSignature: compactLines.slice(0, 2).join(" | "),
  };
  const history = Array.isArray(deliveryDashboardState.lyricsSeedHistory)
    ? deliveryDashboardState.lyricsSeedHistory
    : [];
  const previous = history[history.length - 1];
  if (
    previous &&
    previous.seedTag === entry.seedTag &&
    previous.title === entry.title &&
    previous.lineSignature === entry.lineSignature
  ) {
    return;
  }
  deliveryDashboardState.lyricsSeedHistory = [...history, entry].slice(-12);
}

function resolveSectionProfileModule(section) {
  const key = String(section || "").toLowerCase();
  if (key.includes("chorus 4")) {
    return {
      scale: [0, 7, 12, 16, 19, 24],
      motif: [0, 4, 5, 4, 2, 4, 5, 4, 2, 0],
      leadBoost: 1.24,
      hook: [0, 7, 12, 7, 5, 4, 2, 0],
      cadence: [12, 7, 5, 4],
      anchor: [0, 7, 12, 7, 0, 7, 12, 5],
    };
  }
  if (
    key.includes("chorus 3") ||
    key.includes("chorus 2") ||
    key.includes("chorus")
  ) {
    return {
      scale: [0, 4, 7, 11, 12, 16, 19],
      motif: [0, 2, 4, 2, 0, 2, 5, 4, 2, 0],
      leadBoost: 1.14,
      hook: [0, 4, 7, 4, 2, 4, 7, 4],
      cadence: [7, 4, 2, 0],
      anchor: [0, 4, 7, 4, 0, 4, 7, 2],
    };
  }
  if (key.includes("bridge")) {
    return {
      scale: [0, 2, 7, 9, 12, 14, 19],
      motif: [0, 3, 5, 6, 5, 3, 1, 0],
      leadBoost: 0.96,
      hook: [0, 3, 6, 5],
      cadence: [6, 5, 3, 0],
      anchor: [0, 3, 5, 6, 5, 3],
    };
  }
  if (key.includes("outro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 1, 2, 3, 2, 1, 0],
      leadBoost: 0.9,
      hook: [0, 2, 3, 2],
      cadence: [3, 2, 1, 0],
      anchor: [0, 2, 3, 2, 1, 0],
    };
  }
  if (key.includes("intro")) {
    return {
      scale: [0, 3, 7, 10, 12, 15, 19],
      motif: [0, 2, 3, 2, 0, 1],
      leadBoost: 0.82,
      hook: [0, 1, 2, 1],
      cadence: [2, 1, 0, 0],
      anchor: [0, 1, 2, 1, 0, 0],
    };
  }
  return {
    scale: [0, 3, 7, 10, 12, 15, 19],
    motif: [0, 1, 3, 1, 4, 3, 1, 0],
    leadBoost: 1,
    hook: [0, 3, 1, 0],
    cadence: [3, 1, 0, 0],
    anchor: [0, 1, 3, 1, 4, 3, 1, 0],
  };
}

function buildLeadDegreesModule(sectionProfile, noteCount, scale) {
  const safeCount = Math.max(4, noteCount || 8);
  const degrees = [];
  const isChorusLike =
    Array.isArray(sectionProfile.anchor) &&
    sectionProfile.anchor.length >= 4 &&
    Array.isArray(sectionProfile.cadence) &&
    sectionProfile.cadence.length >= 3;

  if (isChorusLike && safeCount >= 8) {
    const anchor = sectionProfile.anchor;
    const cadence = sectionProfile.cadence;
    const verseWindow = Math.max(0, safeCount - cadence.length);
    for (let i = 0; i < verseWindow; i += 1) {
      if (i < Math.min(anchor.length, 8)) {
        degrees.push(anchor[i % anchor.length] || 0);
      } else {
        const motif =
          sectionProfile.motif[i % sectionProfile.motif.length] || 0;
        degrees.push(scale[motif % scale.length] || 0);
      }
    }
    cadence.forEach((degree) => {
      degrees.push(degree || 0);
    });
    return degrees.slice(0, safeCount);
  }

  for (let i = 0; i < safeCount; i += 1) {
    const motif = sectionProfile.motif[i % sectionProfile.motif.length] || 0;
    degrees.push(scale[motif % scale.length] || 0);
  }
  return degrees;
}

function formatActLabelModule(actNumber) {
  return `第${actNumber}幕`;
}

function buildStructuredSegmentsModule(lines, count, baseTitle) {
  const targetCount = Math.max(1, Number(count || 1));
  const grouped = groupScenes(Array.isArray(lines) ? lines : []).filter(
    (scene) => Array.isArray(scene?.lines) && scene.lines.length,
  );
  if (grouped.length >= targetCount) {
    return grouped.slice(0, targetCount).map((scene, index) => ({
      title: String(scene?.title || `${baseTitle} ${index + 1}`).trim(),
      lines: scene.lines
        .map((line) => String(line || "").trim())
        .filter(Boolean),
    }));
  }
  const safeLines = (Array.isArray(lines) ? lines : [])
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const buckets = Array.from({ length: targetCount }, () => []);
  safeLines.forEach((line, index) => {
    buckets[index % targetCount].push(line);
  });
  return buckets.map((bucket, index) => ({
    title: `${baseTitle} ${index + 1}`,
    lines: bucket.length
      ? bucket
      : safeLines.slice(0, Math.min(4, safeLines.length)),
  }));
}

function storedWorkTypeForStructuredRoleModule(
  role,
  fallbackWorkType = "single",
) {
  const normalizedRole = String(role || "")
    .trim()
    .toLowerCase();
  const normalizedType = normalizeWorkTypeClient(fallbackWorkType);
  if (normalizedRole === "opera" || normalizedRole === "act") return "opera";
  if (normalizedRole === "triptych") return "triptych";
  if (
    normalizedRole === "scene" ||
    normalizedRole === "single" ||
    normalizedRole === "part"
  )
    return "single";
  return normalizedType;
}

function buildHierarchyFromStructureTreeModule(
  tree,
  lyricsText,
  fallbackTitle,
  fallbackWorkType,
) {
  const nodes = Array.isArray(tree) ? tree : [];
  if (!nodes.length) return [];
  const lyricLines = String(lyricsText || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const leaves = [];
  const collectLeaves = (items) => {
    items.forEach((node) => {
      const children = Array.isArray(node?.children) ? node.children : [];
      if (!children.length) {
        leaves.push(node);
        return;
      }
      collectLeaves(children);
    });
  };
  collectLeaves(nodes);
  const segments = buildStructuredSegmentsModule(
    lyricLines,
    Math.max(leaves.length, 1),
    String(fallbackTitle || "CSS MV").trim() || "CSS MV",
  );
  let leafIndex = 0;
  const mapNode = (node) => {
    const children = Array.isArray(node?.children) ? node.children : [];
    const role = String(node?.role || "scene")
      .trim()
      .toLowerCase();
    const title =
      String(node?.title || "").trim() ||
      String(fallbackTitle || "CSS MV").trim() ||
      "CSS MV";
    const sequenceIndex = Number(node?.sequenceIndex || 0);
    if (!children.length) {
      const segment = segments[leafIndex] ||
        segments[segments.length - 1] || { lines: lyricLines };
      const segmentLines = Array.isArray(segment?.lines)
        ? segment.lines
        : lyricLines;
      leafIndex += 1;
      return {
        title,
        work_type: storedWorkTypeForStructuredRoleModule(
          role,
          node?.workType || fallbackWorkType || "single",
        ),
        structure_role: role,
        sequence_index: sequenceIndex || leafIndex,
        lyrics_text: segmentLines.join("\n"),
        lyrics_preview: segmentLines.join("\n"),
        cover_image: buildForyouThumbSvg(title, "", segmentLines),
        style: "",
        children: [],
      };
    }
    const mappedChildren = children.map((child) => mapNode(child));
    const aggregatePreview = mappedChildren
      .map((child) => String(child?.lyrics_preview || "").trim())
      .filter(Boolean)
      .join("\n")
      .slice(0, 500);
    return {
      title,
      work_type: storedWorkTypeForStructuredRoleModule(
        role,
        node?.workType || fallbackWorkType || "single",
      ),
      structure_role: role,
      sequence_index: sequenceIndex || 0,
      lyrics_preview: aggregatePreview,
      cover_image: buildForyouThumbSvg(
        title,
        "",
        aggregatePreview.split("\n").filter(Boolean),
      ),
      style: "",
      children: mappedChildren,
    };
  };
  return nodes.map((node) => mapNode(node));
}

function getSongSeedErrorCodeModule(payload) {
  const data = getApiDataModule(payload);
  return String(
    data?.openai_error_code || payload?.openai_error_code || "",
  ).trim();
}

function getSongSeedErrorTypeModule(payload) {
  const data = getApiDataModule(payload);
  return String(
    data?.openai_error_type || payload?.openai_error_type || "",
  ).trim();
}

function getSongSeedErrorMessageModule(payload) {
  const data = getApiDataModule(payload);
  return String(
    data?.openai_error_message || payload?.openai_error_message || "",
  ).trim();
}

function getSongSeedErrorStatusModule(payload) {
  const data = getApiDataModule(payload);
  const value = Number(
    data?.openai_error_status ?? payload?.openai_error_status,
  );
  return Number.isFinite(value) ? value : 0;
}

function getSongSeedOpenAiModelModule(payload) {
  const data = getApiDataModule(payload);
  return String(
    data?.openai_model ||
      data?.model ||
      payload?.openai_model ||
      payload?.model ||
      "",
  ).trim();
}

function getSongSeedOpenAiEnvSourceModule(payload) {
  const data = getApiDataModule(payload);
  const raw = String(
    data?.openai_env_source || payload?.openai_env_source || "",
  ).trim();
  if (!raw) return "";
  if (/\/srv\/cssos\/releases\/.+\/\.env\.local$/i.test(raw)) {
    return "/srv/cssos.env";
  }
  return raw;
}

function getSongSeedOpenAiKeyFingerprintModule(payload) {
  const data = getApiDataModule(payload);
  return String(
    data?.openai_key_fingerprint || payload?.openai_key_fingerprint || "",
  ).trim();
}

function isSongSeedQuotaExceededModule(payload) {
  const code = getSongSeedErrorCodeModule(payload);
  const type = getSongSeedErrorTypeModule(payload);
  return (
    code === "insufficient_quota" ||
    code === "billing_hard_limit_reached" ||
    type === "insufficient_quota"
  );
}

function isSongSeedRateLimitedModule(payload) {
  const status = getSongSeedErrorStatusModule(payload);
  const code = getSongSeedErrorCodeModule(payload);
  const type = getSongSeedErrorTypeModule(payload);
  return (
    status === 429 &&
    !isSongSeedQuotaExceededModule(payload) &&
    (code === "rate_limit_exceeded" || type === "rate_limit_exceeded" || !code)
  );
}

function formatSongSeedUpstreamDebugModule(payload) {
  const status = getSongSeedErrorStatusModule(payload);
  const type = getSongSeedErrorTypeModule(payload);
  const code = getSongSeedErrorCodeModule(payload);
  const model = getSongSeedOpenAiModelModule(payload);
  const envSource = getSongSeedOpenAiEnvSourceModule(payload);
  const keyFingerprint = getSongSeedOpenAiKeyFingerprintModule(payload);
  return [
    status ? `status=${status}` : "",
    type ? `type=${type}` : "",
    code ? `code=${code}` : "",
    model ? `model=${model}` : "",
    envSource ? `env=${envSource}` : "",
    keyFingerprint ? `key=${keyFingerprint}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

function getSongSeedQuotaExceededMessageModule(payload) {
  const detail = getSongSeedErrorMessageModule(payload);
  const debug = formatSongSeedUpstreamDebugModule(payload);
  return loginCopy(
    `OpenAI upstream rejected lyric generation as quota-related${debug ? ` · ${debug}` : ""}${detail ? ` · ${detail}` : ""}.`,
  );
}

function getSongSeedRateLimitMessageModule(payload) {
  const detail = getSongSeedErrorMessageModule(payload);
  const debug = formatSongSeedUpstreamDebugModule(payload);
  return loginCopy(
    `OpenAI upstream rate-limited lyric generation${debug ? ` · ${debug}` : ""}${detail ? ` · ${detail}` : ""}.`,
  );
}

function runNonCriticalUiStepModule(task) {
  try {
    task?.();
    return true;
  } catch (_error) {
    return false;
  }
}

function safeShowToastModule(message) {
  return runNonCriticalUiStepModule(() => showToast(message));
}

function seedRefreshDebugCopyModule(kind, detail = {}) {
  const attempt = Number(detail.attempt || 0);
  const maxAttempts = Number(detail.maxAttempts || 0);
  switch (String(kind || "").trim()) {
    case "titleContext":
      return loginCopy(
        "Button triggered. Checking lyric title context...",
      );
    case "requestLyrics":
      return loginCopy(
        "Button triggered. Requesting random lyrics from the server...",
      );
    case "uiWarmupFailed":
      return loginCopy(
        "Lyric UI warmup failed. Continuing with a direct lyric request...",
      );
    case "apiReturned":
      return loginCopy(
        "API responded. Applying generated lyrics into the editor...",
      );
    case "apiNoUsableData":
      return loginCopy(
        "Button triggered, but the lyric API did not return usable data.",
      );
    case "retryRecentTitle":
      return loginCopy(
        `Retrying lyric title ${attempt}/${maxAttempts} to avoid a recent duplicate...`,
      );
    case "retryVariation":
      return loginCopy(
        `Retrying lyric variation ${attempt}/${maxAttempts}...`,
      );
    default:
      return "";
  }
}

function summarizeErrorModule(err) {
  if (!err) return "unknown";
  if (typeof err === "string") return err.slice(0, 120);
  const name = String(err?.name || "").trim();
  const message = String(err?.message || "").trim();
  return [name, message].filter(Boolean).join(": ").slice(0, 160) || "unknown";
}

function getSeedRefreshToastModule(target) {
  if (target === "lyrics")
    return loginCopy("Casting lyric magic...");
  if (target === "style")
    return loginCopy(
      "Music style magic in progress...",
    );
  if (target === "structure")
    return loginCopy(
      "Music structure magic in progress...",
    );
  if (target === "outline")
    return loginCopy(
      "Video outline magic in progress...",
    );
  if (target === "scenes")
    return loginCopy(
      "Scene prompt magic in progress...",
    );
  return loginCopy("Magic in progress...");
}

function bindSeedRefreshButtonModule(button, target, options = {}) {
  if (!(button instanceof HTMLButtonElement)) return;
  if (button.dataset.seedRefreshBound === "1") return;
  button.dataset.seedRefreshBound = "1";
  const shouldPrime = options?.prime === true;
  if (shouldPrime) {
    button.addEventListener("pointerdown", (event) => {
      if (window.CSSOS_primeLyricsRegenerate) {
        window.CSSOS_primeLyricsRegenerate(event);
      }
    });
  }
  button.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    void regenerateSeedFields(target);
  });
}

function ensureSongSeedTitleContextModule() {
  const existing = getSongSeedTitleContextModule();
  if (existing) return existing;
  const fallback = buildFallbackSongSeedTitleModule();
  return setSongSeedTitleValueModule(fallback, { userEdited: false });
}

function safeBuildLyricsSeedVisualSignatureModule(seed) {
  try {
    return buildLyricsSeedVisualSignatureModule(seed);
  } catch (_error) {
    return "";
  }
}

async function regenerateSeedFieldsModule(target) {
  const triggerMap = {
    lyrics: lyricsRegenerate,
    style: styleRegenerate,
    structure: musicStructureRegenerate,
    outline: videoOutlineRegenerate,
    scenes: sectionPromptsRegenerate,
  };
  const trigger = triggerMap[target] || lyricsRegenerate;
  let lyricStage = "init";
  try {
    if (target === "lyrics") {
      setLyricsDebugStatus(
        seedRefreshDebugCopyModule("titleContext"),
        "pending",
      );
      lyricRegenerateRequestActive = true;
    }
    lyricStage = "title-context";
    const title =
      target === "lyrics" && !shouldPreserveSongSeedTitleForRefresh()
        ? ""
        : ensureSongSeedTitleContextModule();
    if (target === "lyrics") {
      setLyricsDebugStatus(
        seedRefreshDebugCopyModule("requestLyrics"),
        "pending",
      );
    }
    lyricStage = "button-busy";
    setButtonBusy(trigger, true);
    const previousLyricsValue = String(lyricsInput?.value || "");
    const previousTitleValue = String(titleInput?.value || "");
    lyricStage = "signature";
    const previousSignature = safeBuildLyricsSeedVisualSignatureModule({
      title,
      lyrics:
        lyricsInput?.value || compactLyricLines(state.lines || []).join("\n"),
    });
    if (target === "lyrics") {
      lyricStage = "ui-warmup";
      const lyricUiOk = runNonCriticalUiStep(() => {
        enterLyricSpellcast();
        randomizeCreationForLyricsRefresh(title);
      });
      if (!lyricUiOk) {
        setLyricsDebugStatus(
          seedRefreshDebugCopyModule("uiWarmupFailed"),
          "pending",
        );
      }
      const prewarmTitle = String(
        title || titleInput?.value || state.title || loginCopy("CSS MV")
      ).trim();
      const prewarmLines = compactLyricLines(
        String(lyricsInput?.value || state.songSeed?.lyrics || "")
          .split("\n")
          .filter(Boolean)
      ).slice(0, 8);
      void globalThis.requestWatchFrameArtworkModule?.(
        prewarmTitle,
        t("watch.status.requestingLyricsSeed"),
        prewarmLines
      );
    }
    lyricStage = "toast";
    safeShowToast(getSeedRefreshToast(target));
    let payload = null;
    let raw = null;
    let normalized = null;
    let nextSignature = "";
    const maxAttempts = target === "lyrics" ? 5 : 1;
    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      lyricStage = `request-${attempt}`;
      // CSSOS_PHASE2_WAND_BYPASS_SAVED 20260430 #215 — Jing
      // "API responded, but the lyrics were not filled into the editor.
      //  高级设置面板的自定义歌词魔法棒又无法施展魔法了。"
      // Root cause: clicking a saved work in #214 sets
      // cssmvPipelineLastResult with freshMs=24h, which the wand's call
      // path treats as "lyrics already owned" and returns the SAVED
      // work's lyrics in `data` — not generating fresh ones. Pass
      // allowLegacyAlongsideMv:true so the explicit wand press bypasses
      // the freshness guard and always hits the LLM.
      payload = await runLyricsGenerate(
        target === "style" ? "style_refresh" : "music_video",
        { apply: false, allowLegacyAlongsideMv: true },
      );
      if (isSongSeedQuotaExceededModule(payload)) {
        const quotaMessage = getSongSeedQuotaExceededMessageModule(payload);
        setLyricsDebugStatus(quotaMessage, "error");
        safeShowToast(quotaMessage);
        return;
      }
      if (isSongSeedRateLimitedModule(payload)) {
        const rateLimitMessage = getSongSeedRateLimitMessageModule(payload);
        setLyricsDebugStatus(rateLimitMessage, "error");
        safeShowToast(rateLimitMessage);
        return;
      }
      lyricStage = `response-${attempt}`;
      raw = getApiDataModule(payload);
      if (!payload?.ok || payload?.empty || !raw) break;
      lyricStage = `normalize-${attempt}`;
      normalized = normalizeSongSeedModule(raw);
      nextSignature = safeBuildLyricsSeedVisualSignatureModule(normalized);
      const repeatedAutoTitle =
        target === "lyrics" &&
        (globalThis.shouldRetryAutoSongSeedTitleModule?.(normalized?.title) ??
          false);
      if (
        target !== "lyrics" ||
        (!repeatedAutoTitle &&
          (!previousSignature ||
            !nextSignature ||
            nextSignature !== previousSignature))
      ) {
        break;
      }
      if (attempt < maxAttempts) {
        lyricStage = `retry-toast-${attempt}`;
        safeShowToast(
          seedRefreshDebugCopyModule(
            repeatedAutoTitle ? "retryRecentTitle" : "retryVariation",
            {
              attempt: attempt + 1,
              maxAttempts,
            },
          ),
        );
      }
    }
    if (!payload?.ok || payload?.empty || !raw) {
      if (target === "lyrics") {
        setLyricsDebugStatus(
          seedRefreshDebugCopyModule("apiNoUsableData"),
          "error",
        );
      }
      safeShowToast(t("toast.seedRefreshFailed"));
      return;
    }
    if (target === "lyrics") {
      setLyricsDebugStatus(
        seedRefreshDebugCopyModule("apiReturned"),
        "pending",
      );
    }
    lyricStage = "apply";
    if (!normalized) normalized = normalizeSongSeedModule(raw);
    if (target === "style") {
      if (styleInput && normalized.musicStyle)
        styleInput.value = normalized.musicStyle;
      state.songSeed = { ...(state.songSeed || {}), ...normalized };
      updateEnginePanels(
        titleInput?.value?.trim() || state.title,
        (lyricsInput?.value || "").split("\n"),
      );
      renderSongSeedPreview(state.songSeed);
      safeShowToast(t("toast.musicStyleRegenerated"));
      return;
    }
    if (target === "structure") {
      if (musicStructureInput) {
        musicStructureInput.value = [
          normalized.musicStructure,
          globalThis.renderSectionBeatsTextModule?.(normalized.sectionBeats) ??
            "",
        ]
          .filter(Boolean)
          .join("\n\n");
      }
      state.songSeed = { ...(state.songSeed || {}), ...normalized };
      renderSongSeedPreview(state.songSeed);
      safeShowToast(loginCopy("Music structure updated."));
      return;
    }
    if (target === "outline") {
      if (videoOutlineInput) videoOutlineInput.value = normalized.videoOutline;
      state.songSeed = { ...(state.songSeed || {}), ...normalized };
      renderSongSeedPreview(state.songSeed);
      safeShowToast(loginCopy("Video outline updated."));
      return;
    }
    if (target === "scenes") {
      if (sectionPromptsInput) {
        sectionPromptsInput.value =
          globalThis.renderSectionPromptsTextModule?.(
            normalized.sectionPrompts,
          ) ?? "";
      }
      state.songSeed = { ...(state.songSeed || {}), ...normalized };
      renderSongSeedPreview(state.songSeed);
      safeShowToast(
        loginCopy("Section prompts updated."),
      );
      return;
    }
    applySongSeedToSettings(raw);
    if (target === "lyrics") {
      const appliedTitle = String(titleInput?.value || normalized?.title || title || "").trim();
      const appliedLines = compactLyricLines(String(lyricsInput?.value || normalized?.lyrics || "").split("\n")).slice(0, 8);
      void globalThis.requestWatchFrameArtworkModule?.(
        appliedTitle || loginCopy("CSS MV"),
        String(normalized?.musicStyle || normalized?.creativeSummary?.compact || "").trim() || t("watch.status.waitingImage"),
        appliedLines
      );
    }
    if (target === "lyrics") {
      const currentLyricsValue = String(lyricsInput?.value || "");
      const currentTitleValue = String(titleInput?.value || "");
      const applied =
        currentLyricsValue.trim().length > 0 &&
        (currentLyricsValue !== previousLyricsValue ||
          currentTitleValue !== previousTitleValue);
      setLyricsDebugStatus(
        applied
          ? loginCopy(
              "API responded and the lyrics were filled into the editor successfully. This step only refreshes lyrics; click Create to continue into music and MV.",
            )
          : loginCopy(
              "API responded, but the lyrics were not filled into the editor.",
            ),
        applied ? "success" : "error",
      );
      if (applied) {
        safeShowToast(
          loginCopy(
            "Lyrics refreshed. Click Create to continue into music and MV.",
          ),
        );
      }
      if (!shouldPreserveSongSeedTitleForRefreshModule()) {
        recordRecentAutoSongSeedTitleModule(currentTitleValue);
      }
      return;
    }
    setLyricsDebugStatus(
      loginCopy("Seed fields refreshed."),
      "success",
    );
  } catch (err) {
    if (target === "lyrics") {
      setLyricsDebugStatus(
        loginCopy(
          `Request failed at ${lyricStage}. ${summarizeError(err)}`,
        ),
        "error",
      );
    }
    safeShowToast(t("toast.seedRefreshFailed"));
  } finally {
    if (target === "lyrics") {
      lyricRegenerateRequestActive = false;
    }
    if (target === "lyrics") exitLyricSpellcast(true);
    setButtonBusy(trigger, false);
  }
}

globalThis.renderSectionPromptsTextModule = renderSectionPromptsTextModule;
globalThis.renderSectionBeatsTextModule = renderSectionBeatsTextModule;
globalThis.normalizeSongSeedModule = normalizeSongSeedModule;
globalThis.buildSeedPreviewSummaryModule = buildSeedPreviewSummaryModule;
globalThis.describeSongSeedUniverseModule = describeSongSeedUniverseModule;
globalThis.buildLyricsSeedVisualSignatureModule =
  buildLyricsSeedVisualSignatureModule;
globalThis.isSongSeedQuotaExceededModule = isSongSeedQuotaExceededModule;
globalThis.isSongSeedRateLimitedModule = isSongSeedRateLimitedModule;
globalThis.getSongSeedQuotaExceededMessageModule =
  getSongSeedQuotaExceededMessageModule;
globalThis.getSongSeedRateLimitMessageModule =
  getSongSeedRateLimitMessageModule;
globalThis.getSongSeedErrorCodeModule = getSongSeedErrorCodeModule;
globalThis.getSongSeedErrorTypeModule = getSongSeedErrorTypeModule;
globalThis.getSongSeedErrorMessageModule = getSongSeedErrorMessageModule;
globalThis.getSongSeedErrorStatusModule = getSongSeedErrorStatusModule;
globalThis.getSongSeedOpenAiModelModule = getSongSeedOpenAiModelModule;
globalThis.getSongSeedOpenAiEnvSourceModule = getSongSeedOpenAiEnvSourceModule;
globalThis.getSongSeedOpenAiKeyFingerprintModule =
  getSongSeedOpenAiKeyFingerprintModule;
globalThis.formatSongSeedUpstreamDebugModule =
  formatSongSeedUpstreamDebugModule;
globalThis.isSongSeedQuotaExceeded = isSongSeedQuotaExceededModule;
globalThis.isSongSeedRateLimited = isSongSeedRateLimitedModule;
globalThis.getSongSeedQuotaExceededMessage =
  getSongSeedQuotaExceededMessageModule;
globalThis.getSongSeedRateLimitMessage = getSongSeedRateLimitMessageModule;
