function buildLocalStructuredChildrenModule(title, lines, style, workType) {
  const seedTree = Array.isArray(state.songSeed?.structureTree) ? state.songSeed.structureTree : [];
  if (seedTree.length) {
    const hierarchy = buildHierarchyFromStructureTree(
      seedTree,
      Array.isArray(lines) ? lines.join("\n") : "",
      title,
      workType
    );
    return (hierarchy[0]?.children || []).map((child, index) => ({
      ...child,
      local_id: child.local_id || `local_structured_${Date.now()}_${index + 1}`,
      style
    }));
  }
  const normalizedType = normalizeWorkTypeClient(workType);
  if (normalizedType === "triptych") {
    return buildStructuredSegments(lines, 3, title).map((segment, index) => ({
      local_id: `local_triptych_${Date.now()}_${index + 1}`,
      title: String(segment?.title || `${title} · ${loginCopy("Part")} ${index + 1}`).trim(),
      style,
      work_type: "single",
      structure_role: "single",
      sequence_index: index + 1,
      lyrics_text: (Array.isArray(segment?.lines) ? segment.lines : []).join("\n"),
      lyrics_preview: (Array.isArray(segment?.lines) ? segment.lines : []).join("\n"),
      cover_image:
        globalThis.buildForyouThumbSvgModule?.(
          String(segment?.title || `${title} · ${loginCopy("Part")} ${index + 1}`).trim(),
          "",
          Array.isArray(segment?.lines) ? segment.lines : []
        ) ?? "",
      children: []
    }));
  }
  if (normalizedType === "opera") {
    const estimatedShape =
      globalThis.estimateOperaShapeModule?.(
        {
          title,
          lyrics: Array.isArray(lines) ? lines.join("\n") : "",
          sectionPrompts: Array.isArray(state.songSeed?.sectionPrompts) ? state.songSeed.sectionPrompts : [],
          structurePlan: state.songSeed?.structurePlan || null
        },
        null,
        title
      ) || {};
    const totalActs = Math.max(1, Number(estimatedShape.totalActs || state.songSeed?.structurePlan?.totalActs || 1));
    const scenesPerAct = Math.max(
      1,
      Number(estimatedShape.scenesPerAct || state.songSeed?.structurePlan?.scenesPerAct || 1)
    );
    const totalScenes = Math.max(1, totalActs * scenesPerAct);
    const scenes = buildStructuredSegments(lines, totalScenes, title).map((segment, index) => ({
      local_id: `local_scene_${Date.now()}_${index + 1}`,
      title: String(segment?.title || `${title} · Scene ${index + 1}`).trim(),
      style,
      work_type: "single",
      structure_role: "scene",
      sequence_index: index + 1,
      lyrics_text: (Array.isArray(segment?.lines) ? segment.lines : []).join("\n"),
      lyrics_preview: (Array.isArray(segment?.lines) ? segment.lines : []).join("\n"),
      cover_image:
        globalThis.buildForyouThumbSvgModule?.(
          String(segment?.title || `${title} · Scene ${index + 1}`).trim(),
          "",
          Array.isArray(segment?.lines) ? segment.lines : []
        ) ?? "",
      children: []
    }));
    return Array.from({ length: totalActs }, (_, actIndex) => {
      const start = actIndex * scenesPerAct;
      const actScenes = scenes.slice(start, start + scenesPerAct);
      return {
        local_id: `local_act_${Date.now()}_${actIndex + 1}`,
        title: `${title} · ${formatActLabel(actIndex + 1)}`,
        style,
        work_type: "opera",
        structure_role: "act",
        sequence_index: actIndex + 1,
        lyrics_text: actScenes.map((item) => item.lyrics_text || item.lyrics_preview).join("\n").trim(),
        lyrics_preview: actScenes.map((item) => item.lyrics_preview).join("\n"),
        cover_image:
          globalThis.buildForyouThumbSvgModule?.(
            `${title} · ${formatActLabel(actIndex + 1)}`,
            "",
            actScenes
              .map((item) => item.lyrics_preview)
              .join("\n")
              .split("\n")
              .filter(Boolean)
          ) ?? "",
        children: actScenes
      };
    }).filter((item) => Array.isArray(item.children) && item.children.length);
  }
  return [];
}

async function fetchMyWorkHierarchyModule(limit = 200) {
  if (!authState.user) return [];
  try {
    const res = await fetch(`/api/works/mine?limit=${limit}`, { credentials: "include" });
    const payload = getApiData(await res.json().catch(() => null));
    return Array.isArray(payload?.works) ? payload.works : [];
  } catch (_err) {
    return [];
  }
}

async function createWorkNodeRecordModule(payload) {
  const res = await fetch("/api/works", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  const response = await res.json().catch(() => null);
  const data = getApiData(response);
  if (!res.ok || !data?.id) {
    throw new Error(response?.code || `work_create_failed:${res.status}`);
  }
  globalThis.recordWorkspaceTouchModule?.({
    ...payload,
    ...data,
    id: data.id,
    work_id: data.id,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });
  return data;
}

async function updateWorkStructurePlanModule(workId, structurePlan) {
  const targetId = String(workId || "").trim();
  if (!targetId || !structurePlan) return null;
  const res = await fetch(`/api/works/${encodeURIComponent(targetId)}/structure-plan`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ structure_plan: structurePlan })
  });
  const response = await res.json().catch(() => null);
  const data = getApiData(response);
  if (!res.ok) {
    throw new Error(response?.code || `work_structure_plan_failed:${res.status}`);
  }
  return data;
}

async function updateWorkGenerationModule(workId, payload = {}) {
  const targetId = String(workId || "").trim();
  if (!targetId) return null;
  const res = await fetch(`/api/works/${encodeURIComponent(targetId)}/generation`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify(payload)
  });
  const response = await res.json().catch(() => null);
  const data = getApiData(response);
  if (!res.ok) {
    throw new Error(response?.code || `work_generation_update_failed:${res.status}`);
  }
  return data;
}

async function createStructuredWorkNodesModule(nodes, style, pricingDefaults, parentWorkId = null, rootWorkId = null, sourceRunId = "") {
  const list = Array.isArray(nodes) ? nodes : [];
  const created = [];
  const economics = estimateCreationEconomics();
  const resolvedListenPriceCents = Math.max(
    0,
    Number(economics.suggestedListenPriceCents || pricingDefaults.listenCents || 0)
  );
  const resolvedBuyoutPriceCents = Math.max(
    0,
    Number(economics.suggestedBuyoutPriceCents || pricingDefaults.buyoutCents || 0)
  );
  const resolvedSourceRunId = String(sourceRunId || micState.jobId || "").trim();
  for (const node of list) {
    const record = await createWorkNodeRecordModule({
      title: String(node?.title || "").trim(),
      style,
      work_type: storedWorkTypeForStructuredRole(node?.structure_role, node?.work_type),
      parent_work_id: parentWorkId,
      root_work_id: rootWorkId,
      structure_role: String(node?.structure_role || "single").trim(),
      sequence_index: Number(node?.sequence_index || 0),
      structure_plan: node?.structure_plan || null,
      listen_price_cents: resolvedListenPriceCents,
      buyout_price_cents: resolvedBuyoutPriceCents,
      lyrics_preview: String(node?.lyrics_preview || "").trim(),
      source_run_id: resolvedSourceRunId,
      compute_units_estimate: economics.computeUnits,
      compute_cost_cents_estimate: economics.computeCostCents,
      suggested_listen_price_cents: economics.suggestedListenPriceCents,
      suggested_buyout_price_cents: economics.suggestedBuyoutPriceCents,
      cover_image: String(node?.cover_image || "").trim(),
      preview_image_url: "",
      preview_video_url: ""
    });
    const createdNode = {
      ...node,
      ...record,
      children: Array.isArray(node?.children) ? node.children : []
    };
    const resolvedRootId = rootWorkId || record.id;
    if (Array.isArray(node?.children) && node.children.length) {
      createdNode.children = await createStructuredWorkNodesModule(
        node.children,
        style,
        pricingDefaults,
        record.id,
        resolvedRootId,
        resolvedSourceRunId
      );
    }
    created.push(createdNode);
  }
  return created;
}

function findWorkByTitleAndTypeModule(works, title, workType) {
  const expectedTitle = String(title || "").trim();
  const expectedType = normalizeWorkTypeClient(workType);
  return (Array.isArray(works) ? works : []).find(
    (work) =>
      String(work?.title || "").trim() === expectedTitle &&
      normalizeWorkTypeClient(work?.work_type) === expectedType
  );
}

window.buildLocalStructuredChildrenModule = buildLocalStructuredChildrenModule;
window.fetchMyWorkHierarchyModule = fetchMyWorkHierarchyModule;
window.createWorkNodeRecordModule = createWorkNodeRecordModule;
window.updateWorkStructurePlanModule = updateWorkStructurePlanModule;
window.updateWorkGenerationModule = updateWorkGenerationModule;
window.createStructuredWorkNodesModule = createStructuredWorkNodesModule;
window.findWorkByTitleAndTypeModule = findWorkByTitleAndTypeModule;
