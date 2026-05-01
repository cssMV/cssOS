function findActNodeModule(rootWork, actNumber) {
  const children = Array.isArray(rootWork?.children) ? rootWork.children : [];
  return children.find((child) => {
    if (String(child?.structure_role || "").trim().toLowerCase() !== "act") return false;
    if (Number(child?.sequence_index || 0) === actNumber) return true;
    return String(child?.title || "").includes(formatActLabel(actNumber));
  });
}

async function createTriptychWorkRecordModule(title, lines, style, pricingDefaults) {
  const sourceRunId = String(micState.jobId || "").trim();
  const hierarchy = buildSongSeedHierarchy({
    ...state.songSeed,
    title: String(title || "").trim(),
    lyrics: Array.isArray(lines) ? lines.join("\n") : "",
    workType: "triptych"
  });
  const rootSeed = hierarchy[0] || {
    title,
    work_type: "triptych",
    structure_role: "triptych",
    sequence_index: 1,
    lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
    children: []
  };
  const allWorks = await fetchMyWorkHierarchy();
  let root = findWorkByTitleAndType(allWorks, String(title || "").trim(), "triptych");
  if (!root) {
    const initialPlan = buildTriptychStructurePlan(null, state.songSeed, String(title || "").trim());
    const [createdRoot] = await createStructuredWorkNodes(
      [{ ...rootSeed, children: [], structure_plan: initialPlan }],
      style,
      pricingDefaults,
      null,
      null,
      sourceRunId
    );
    root = createdRoot;
  } else if (!normalizeStructurePlanClient(root?.structure_plan)) {
    const initialPlan = buildTriptychStructurePlan(root, state.songSeed, String(title || "").trim());
    try {
      const updated = await updateWorkStructurePlan(root.id, initialPlan);
      root.structure_plan = updated?.structure_plan || initialPlan;
    } catch (_err) {
      root.structure_plan = initialPlan;
    }
  }
  root.children = Array.isArray(root?.children) ? root.children : [];
  const nextPlan = buildTriptychStructurePlan(root, state.songSeed, String(title || "").trim());
  if (nextPlan?.completed) {
    showToast(loginCopy("This triptych is already complete."));
    return root;
  }
  const targetPartNumber = Number(nextPlan?.targetPartNumber || 1);
  const partBlueprint = (Array.isArray(rootSeed.children) ? rootSeed.children : []).find(
    (item) => Number(item?.sequence_index || 0) === targetPartNumber
  ) || {
    title: `${title} · ${loginCopy("Part")} ${targetPartNumber}`,
    work_type: "single",
    structure_role: "part",
    sequence_index: targetPartNumber,
    lyrics_preview: Array.isArray(lines) ? lines.join("\n") : "",
    children: []
  };
  const [createdPart] = await createStructuredWorkNodes(
    [{ ...partBlueprint, children: [] }],
    style,
    pricingDefaults,
    root.id,
    root.id,
    sourceRunId
  );
  root.children.push(createdPart);
  showToast(
    loginCopy(
      `Triptych advanced to Part ${targetPartNumber}.`
    )
  );
  return root;
}

Object.assign(globalThis, {
  findActNodeModule,
  createTriptychWorkRecordModule
});
