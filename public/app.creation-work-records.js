async function createOperaWorkRecordModule(
  title,
  lines,
  style,
  pricingDefaults,
) {
  const sourceRunId = String(micState.jobId || "").trim();
  const rootTitle = String(title || "").trim();
  const structurePlan = buildOperaStructurePlan(
    null,
    state.songSeed,
    rootTitle,
  );
  const hierarchy = buildSongSeedHierarchy({
    ...state.songSeed,
    title: rootTitle,
    lyrics: Array.isArray(lines) ? lines.join("\n") : "",
    workType: "opera",
  });
  const rootSeed = hierarchy[0] || {
    title: rootTitle,
    work_type: "opera",
    structure_role: "opera",
    sequence_index: 1,
    lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
    children: [],
  };
  const blueprintActs = Array.isArray(rootSeed.children)
    ? rootSeed.children
    : [];
  const allWorks = await fetchMyWorkHierarchy();
  let root = findWorkByTitleAndType(allWorks, rootTitle, "opera");
  if (!root) {
    const [createdRoot] = await createStructuredWorkNodes(
      [{ ...rootSeed, children: [], structure_plan: structurePlan }],
      style,
      pricingDefaults,
      null,
      null,
      sourceRunId,
    );
    root = createdRoot;
  } else if (!normalizeStructurePlanClient(root?.structure_plan)) {
    try {
      const updated = await updateWorkStructurePlan(root.id, structurePlan);
      root.structure_plan = updated?.structure_plan || structurePlan;
    } catch (_err) {
      root.structure_plan = structurePlan;
    }
  }
  root.children = Array.isArray(root?.children) ? root.children : [];
  const nextPlan = buildOperaStructurePlan(
    root,
    {
      ...(state.songSeed || {}),
      structurePlan,
    },
    rootTitle,
  );
  if (nextPlan?.completed) {
    showToast(
      loginCopy("This opera is already complete."),
    );
    return root;
  }

  const actNumber = Number(nextPlan?.targetActNumber || 1);
  const sceneStart = Number(nextPlan?.sceneStart || 1);
  const sceneEnd = Number(nextPlan?.sceneEnd || sceneStart);
  const actBlueprint = blueprintActs.find(
    (item) => Number(item?.sequence_index || 0) === actNumber,
  ) || {
    title: `${rootTitle} · ${formatActLabel(actNumber)}`,
    sequence_index: actNumber,
    children: [],
  };
  let actNode = root.children.find(
    (child) =>
      String(child?.structure_role || "")
        .trim()
        .toLowerCase() === "act" &&
      Number(child?.sequence_index || 0) === actNumber,
  );
  if (!actNode) {
    const [createdAct] = await createStructuredWorkNodes(
      [{ ...actBlueprint, children: [] }],
      style,
      pricingDefaults,
      root.id,
      root.id,
      sourceRunId,
    );
    actNode = createdAct;
    root.children.push(actNode);
  }
  actNode.children = Array.isArray(actNode?.children) ? actNode.children : [];
  const existingSceneNumbers = new Set(
    actNode.children
      .filter(
        (child) =>
          String(child?.structure_role || "")
            .trim()
            .toLowerCase() === "scene",
      )
      .map((child) => Number(child?.sequence_index || 0))
      .filter((value) => value > 0),
  );
  const blueprintScenes = Array.isArray(actBlueprint.children)
    ? actBlueprint.children
    : [];
  const pendingSceneNumbers = [];
  for (
    let sceneNumber = sceneStart;
    sceneNumber <= sceneEnd;
    sceneNumber += 1
  ) {
    if (!existingSceneNumbers.has(sceneNumber))
      pendingSceneNumbers.push(sceneNumber);
  }
  const fallbackSegments = buildStructuredSegments(
    lines,
    Math.max(pendingSceneNumbers.length, 1),
    `${rootTitle} ${formatActLabel(actNumber)}`,
  );
  const scenesToCreate = pendingSceneNumbers.map((sceneNumber, index) => {
    const blueprintScene = blueprintScenes.find(
      (scene) => Number(scene?.sequence_index || 0) === sceneNumber,
    );
    return {
      ...(blueprintScene || {}),
      title: String(
        blueprintScene?.title ||
          `${rootTitle} · ${formatActLabel(actNumber)} · Scene ${sceneNumber}`,
      ).trim(),
      work_type: "single",
      structure_role: "scene",
      sequence_index: sceneNumber,
      lyrics_preview:
        String(blueprintScene?.lyrics_preview || "").trim() ||
        (Array.isArray(fallbackSegments[index]?.lines)
          ? fallbackSegments[index].lines.join("\n").slice(0, 500)
          : ""),
      children: [],
    };
  });

  if (!scenesToCreate.length) {
    showToast(
      loginCopy("This opera is already complete."),
    );
    return root;
  }

  const createdScenes = await createStructuredWorkNodes(
    scenesToCreate,
    style,
    pricingDefaults,
    actNode.id,
    root.id,
    sourceRunId,
  );
  actNode.children.push(...createdScenes);
  const totalActScenes = Math.max(
    blueprintScenes.length,
    Number(nextPlan?.scenesPerAct || 0),
    Number(
      globalThis.estimateOperaShapeModule?.(state.songSeed, root, rootTitle)
        ?.scenesPerAct || 0,
    ),
  );
  if (sceneEnd >= totalActScenes) {
    showToast(
      loginCopy(
        `${formatActLabel(actNumber)} completed. Next creation will continue into the following act.`,
      ),
    );
  } else {
    showToast(
      loginCopy(
        `${formatActLabel(actNumber)} added Scene ${sceneStart}-${sceneEnd}.`,
      ),
    );
  }
  return root;
}

globalThis.createOperaWorkRecordModule = createOperaWorkRecordModule;
