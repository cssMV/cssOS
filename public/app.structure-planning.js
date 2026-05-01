function countOperaLyricBlocksModule(text = "") {
  const raw = String(text || "").trim();
  if (!raw) return 0;
  return raw
    .split(/\n\s*\n+/)
    .map((block) =>
      block
        .split("\n")
        .map((line) => String(line || "").trim())
        .filter(Boolean),
    )
    .filter((lines) => lines.length).length;
}

function estimateScenesPerActTargetModule(totalScenes = 0) {
  const safeScenes = Math.max(1, Number(totalScenes || 0));
  if (safeScenes <= 4) return safeScenes;
  if (safeScenes <= 8) return 4;
  if (safeScenes <= 15) return 5;
  return 6;
}

function estimateOperaShapeModule(
  seed = state.songSeed,
  existingRoot = null,
  rootTitle = "",
) {
  const requestedTitle = String(rootTitle || seed?.title || "").trim();
  const structureTree = Array.isArray(seed?.structureTree)
    ? seed.structureTree
    : [];
  const treeActs = structureTree.filter(
    (node) =>
      String(node?.role || node?.structure_role || "")
        .trim()
        .toLowerCase() === "act",
  );
  const treeScenes = structureTree.filter(
    (node) =>
      String(node?.role || node?.structure_role || "")
        .trim()
        .toLowerCase() === "scene",
  );
  const prompts = Array.isArray(seed?.sectionPrompts)
    ? seed.sectionPrompts
    : [];
  const promptActMentions = prompts.reduce((max, prompt) => {
    const merged = `${String(prompt?.title || "")} ${String(prompt?.prompt || "")}`;
    return Math.max(max, parseOperaActNumberModule(merged) || 0);
  }, 0);
  const promptSceneMentions = prompts.reduce((count, prompt) => {
    const merged = `${String(prompt?.title || "")} ${String(prompt?.prompt || "")}`;
    return (
      count +
      (/第\s*[0-9一二三四五六七八九十两]+\s*场|scene\s*\d+/i.test(merged)
        ? 1
        : 0)
    );
  }, 0);
  const lyricText = String(seed?.lyrics || "");
  const lyricLines = String(seed?.lyrics || "")
    .split("\n")
    .map((line) => String(line || "").trim())
    .filter(Boolean);
  const lyricBlocks = countOperaLyricBlocksModule(lyricText);
  const lyricActMentions = [
    ...lyricText.matchAll(/第\s*([0-9一二三四五六七八九十两]+)\s*幕/gi),
  ].reduce(
    (max, match) => Math.max(max, parseChineseNumeralModule(match?.[1]) || 0),
    0,
  );
  const lyricSceneMentions = [
    ...lyricText.matchAll(/第\s*([0-9一二三四五六七八九十两]+)\s*场/gi),
  ].reduce(
    (max, match) => Math.max(max, parseChineseNumeralModule(match?.[1]) || 0),
    0,
  );
  const existingActs = Array.isArray(existingRoot?.children)
    ? existingRoot.children.filter(
        (child) =>
          String(child?.structure_role || "")
            .trim()
            .toLowerCase() === "act",
      )
    : [];
  const existingSceneCount = existingActs.reduce((sum, act) => {
    const count = Array.isArray(act?.children)
      ? act.children.filter(
          (child) =>
            String(child?.structure_role || "")
              .trim()
              .toLowerCase() === "scene",
        ).length
      : 0;
    return sum + count;
  }, 0);
  const requestedActs = Number(seed?.structurePlan?.totalActs || 0);
  const requestedScenesPerAct = Number(seed?.structurePlan?.scenesPerAct || 0);
  const explicitActCount = Math.max(
    treeActs.length,
    existingActs.length,
    requestedActs,
    lyricActMentions,
    promptActMentions,
  );
  const inferredTotalScenes = Math.max(
    treeScenes.length,
    prompts.length,
    promptSceneMentions,
    existingSceneCount,
    lyricSceneMentions,
    lyricBlocks,
    lyricLines.length ? Math.ceil(lyricLines.length / 6) : 0,
    /opera|歌剧/i.test(requestedTitle) ? 8 : 0,
  );
  const targetScenesPerAct =
    estimateScenesPerActTargetModule(inferredTotalScenes);
  const scenesPerAct = Math.max(
    1,
    requestedScenesPerAct ||
      Math.max(
        lyricSceneMentions,
        existingActs.reduce((max, act) => {
          const count = Array.isArray(act?.children)
            ? act.children.filter(
                (child) =>
                  String(child?.structure_role || "")
                    .trim()
                    .toLowerCase() === "scene",
              ).length
            : 0;
          return Math.max(max, count);
        }, 0),
        explicitActCount
          ? Math.ceil(
              Math.max(inferredTotalScenes, explicitActCount) /
                explicitActCount,
            )
          : 0,
        targetScenesPerAct,
      ),
  );
  const totalActs = Math.max(
    1,
    requestedActs ||
      treeActs.length ||
      lyricActMentions ||
      promptActMentions ||
      (explicitActCount
        ? Math.ceil(Math.max(inferredTotalScenes, scenesPerAct) / scenesPerAct)
        : 0) ||
      Math.ceil(Math.max(inferredTotalScenes, scenesPerAct) / scenesPerAct),
  );
  const scenesPerBatch = Math.max(
    1,
    Number(seed?.structurePlan?.scenesPerBatch || 0) ||
      Math.min(
        scenesPerAct,
        inferredTotalScenes >= 15 ? 4 : inferredTotalScenes >= 8 ? 3 : 2,
      ),
  );
  return {
    totalActs,
    scenesPerAct,
    scenesPerBatch,
  };
}

function normalizeStructurePlanClientModule(value) {
  if (!value || typeof value !== "object") return null;
  const plan = value;
  const normalizeInt = (input, fallback = 0) => {
    const parsed = Number.parseInt(String(input ?? ""), 10);
    if (!Number.isFinite(parsed) || parsed <= 0) return fallback;
    return parsed;
  };
  const totalActs = normalizeInt(plan.totalActs);
  const scenesPerAct = normalizeInt(plan.scenesPerAct);
  const scenesPerBatch = normalizeInt(plan.scenesPerBatch);
  const targetActNumber = normalizeInt(plan.targetActNumber);
  const sceneStart = normalizeInt(plan.sceneStart);
  const sceneEnd = normalizeInt(plan.sceneEnd);
  const totalParts = normalizeInt(plan.totalParts);
  const partsPerBatch = normalizeInt(plan.partsPerBatch);
  const targetPartNumber = normalizeInt(plan.targetPartNumber);
  if (
    !totalActs &&
    !scenesPerAct &&
    !scenesPerBatch &&
    !targetActNumber &&
    !sceneStart &&
    !sceneEnd &&
    !totalParts &&
    !partsPerBatch &&
    !targetPartNumber
  ) {
    return null;
  }
  return {
    ...(totalActs ? { totalActs } : {}),
    ...(scenesPerAct ? { scenesPerAct } : {}),
    ...(scenesPerBatch ? { scenesPerBatch } : {}),
    ...(targetActNumber ? { targetActNumber } : {}),
    ...(sceneStart ? { sceneStart } : {}),
    ...(sceneEnd ? { sceneEnd } : {}),
    ...(totalParts ? { totalParts } : {}),
    ...(partsPerBatch ? { partsPerBatch } : {}),
    ...(targetPartNumber ? { targetPartNumber } : {}),
  };
}

function buildOperaStructurePlanModule(
  existingRoot,
  seed = state.songSeed,
  rootTitle = "",
) {
  const requestedTitle = String(rootTitle || seed?.title || "").trim();
  const planFromSeed =
    requestedTitle && String(seed?.title || "").trim() === requestedTitle
      ? normalizeStructurePlanClientModule(seed?.structurePlan)
      : null;
  const planFromRoot = normalizeStructurePlanClientModule(
    existingRoot?.structure_plan,
  );
  const acts = Array.isArray(existingRoot?.children)
    ? existingRoot.children
        .filter(
          (child) =>
            String(child?.structure_role || "")
              .trim()
              .toLowerCase() === "act",
        )
        .sort(
          (a, b) =>
            Number(a?.sequence_index || 0) - Number(b?.sequence_index || 0),
        )
    : [];
  const inferredActCount = acts.reduce(
    (max, act) => Math.max(max, Number(act?.sequence_index || 0) || 0),
    acts.length,
  );
  const inferredScenesPerAct = acts.reduce((max, act) => {
    const count = (Array.isArray(act?.children) ? act.children : [])
      .filter(
        (child) =>
          String(child?.structure_role || "")
            .trim()
            .toLowerCase() === "scene",
      )
      .reduce(
        (sceneMax, child) =>
          Math.max(sceneMax, Number(child?.sequence_index || 0) || 0),
        0,
      );
    return Math.max(max, count);
  }, 0);
  const estimatedShape = estimateOperaShapeModule(
    seed,
    existingRoot,
    requestedTitle,
  );
  const totalActs = Math.max(
    1,
    planFromRoot?.totalActs ||
      planFromSeed?.totalActs ||
      inferredActCount ||
      estimatedShape.totalActs,
  );
  const scenesPerAct = Math.max(
    1,
    planFromRoot?.scenesPerAct ||
      planFromSeed?.scenesPerAct ||
      inferredScenesPerAct ||
      estimatedShape.scenesPerAct,
  );
  const scenesPerBatch = Math.max(
    1,
    planFromRoot?.scenesPerBatch ||
      planFromSeed?.scenesPerBatch ||
      estimatedShape.scenesPerBatch,
  );
  for (let actIndex = 1; actIndex <= totalActs; actIndex += 1) {
    const actNode = acts.find(
      (item) => Number(item?.sequence_index || 0) === actIndex,
    );
    const existingSceneNumbers = new Set(
      (Array.isArray(actNode?.children) ? actNode.children : [])
        .filter(
          (child) =>
            String(child?.structure_role || "")
              .trim()
              .toLowerCase() === "scene",
        )
        .map((child) => Number(child?.sequence_index || 0))
        .filter((value) => value > 0),
    );
    for (
      let sceneStart = 1;
      sceneStart <= scenesPerAct;
      sceneStart += scenesPerBatch
    ) {
      const sceneEnd = Math.min(scenesPerAct, sceneStart + scenesPerBatch - 1);
      const pending = [];
      for (
        let sceneNumber = sceneStart;
        sceneNumber <= sceneEnd;
        sceneNumber += 1
      ) {
        if (!existingSceneNumbers.has(sceneNumber)) pending.push(sceneNumber);
      }
      if (pending.length) {
        return {
          totalActs,
          scenesPerAct,
          scenesPerBatch,
          targetActNumber: actIndex,
          sceneStart: pending[0],
          sceneEnd: pending[pending.length - 1],
        };
      }
    }
  }
  return {
    totalActs,
    scenesPerAct,
    scenesPerBatch,
    targetActNumber: totalActs,
    sceneStart: scenesPerAct,
    sceneEnd: scenesPerAct,
    completed: true,
  };
}

function buildTriptychStructurePlanModule(
  existingRoot,
  seed = state.songSeed,
  rootTitle = "",
) {
  const requestedTitle = String(rootTitle || seed?.title || "").trim();
  const planFromSeed =
    requestedTitle && String(seed?.title || "").trim() === requestedTitle
      ? normalizeStructurePlanClientModule(seed?.structurePlan)
      : null;
  const planFromRoot = normalizeStructurePlanClientModule(
    existingRoot?.structure_plan,
  );
  const totalParts = Math.max(
    1,
    planFromRoot?.totalParts || planFromSeed?.totalParts || 3,
  );
  const partsPerBatch = Math.max(
    1,
    planFromRoot?.partsPerBatch || planFromSeed?.partsPerBatch || totalParts,
  );
  const parts = Array.isArray(existingRoot?.children)
    ? existingRoot.children
        .filter(
          (child) =>
            String(child?.structure_role || "")
              .trim()
              .toLowerCase() === "part",
        )
        .sort(
          (a, b) =>
            Number(a?.sequence_index || 0) - Number(b?.sequence_index || 0),
        )
    : [];
  for (
    let partNumber = 1;
    partNumber <= totalParts;
    partNumber += partsPerBatch
  ) {
    const existingPart = parts.find(
      (item) => Number(item?.sequence_index || 0) === partNumber,
    );
    if (!existingPart) {
      return {
        totalParts,
        partsPerBatch,
        targetPartNumber: partNumber,
      };
    }
  }
  return {
    totalParts,
    partsPerBatch,
    targetPartNumber: totalParts,
    completed: true,
  };
}

function parseChineseNumeralModule(input) {
  const text = String(input || "").trim();
  if (!text) return NaN;
  if (/^\d+$/.test(text)) return Number.parseInt(text, 10);
  const digits = {
    零: 0,
    一: 1,
    二: 2,
    两: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };
  if (text === "十") return 10;
  if (text.includes("十")) {
    const [left, right] = text.split("十");
    const tens = left ? digits[left] || 0 : 1;
    const ones = right ? digits[right] || 0 : 0;
    return tens * 10 + ones;
  }
  return digits[text] ?? NaN;
}

function parseOperaActNumberModule(title) {
  const match = String(title || "").match(
    /第\s*([0-9一二三四五六七八九十两]+)\s*幕/i,
  );
  if (!match) return null;
  const parsed = parseChineseNumeralModule(match[1]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function stripOperaActSuffixModule(title) {
  return String(title || "")
    .replace(/第\s*[0-9一二三四五六七八九十两]+\s*幕/gi, "")
    .replace(/\s+/g, " ")
    .trim();
}

function formatActLabelModuleBridge(actNumber) {
  const bridge = globalThis.readSongSeedUiModule?.(
    "formatActLabelModule",
    `第${actNumber}幕`,
    actNumber,
  );
  return bridge || `第${actNumber}幕`;
}

function buildStructuredSegmentsModuleBridge(lines, count, baseTitle) {
  return (
    globalThis.readSongSeedUiModule?.(
      "buildStructuredSegmentsModule",
      [],
      lines,
      count,
      baseTitle,
    ) || []
  );
}

function storedWorkTypeForStructuredRoleModuleBridge(
  role,
  fallbackWorkType = "single",
) {
  return (
    globalThis.readSongSeedUiModule?.(
      "storedWorkTypeForStructuredRoleModule",
      normalizeWorkTypeClient(fallbackWorkType),
      role,
      fallbackWorkType,
    ) || normalizeWorkTypeClient(fallbackWorkType)
  );
}

function buildHierarchyFromStructureTreeModuleBridge(
  tree,
  lyricsText,
  fallbackTitle,
  fallbackWorkType,
) {
  return (
    globalThis.readSongSeedUiModule?.(
      "buildHierarchyFromStructureTreeModule",
      [],
      tree,
      lyricsText,
      fallbackTitle,
      fallbackWorkType,
    ) || []
  );
}

window.normalizeStructurePlanClientModule = normalizeStructurePlanClientModule;
window.estimateOperaShapeModule = estimateOperaShapeModule;
window.buildOperaStructurePlanModule = buildOperaStructurePlanModule;
window.buildTriptychStructurePlanModule = buildTriptychStructurePlanModule;
window.parseChineseNumeralModule = parseChineseNumeralModule;
window.parseOperaActNumberModule = parseOperaActNumberModule;
window.stripOperaActSuffixModule = stripOperaActSuffixModule;
window.formatActLabelModuleBridge = formatActLabelModuleBridge;
window.buildStructuredSegmentsModuleBridge =
  buildStructuredSegmentsModuleBridge;
window.storedWorkTypeForStructuredRoleModuleBridge =
  storedWorkTypeForStructuredRoleModuleBridge;
window.buildHierarchyFromStructureTreeModuleBridge =
  buildHierarchyFromStructureTreeModuleBridge;
