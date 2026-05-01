function buildWatchArchiveGovernanceMaturityLadderBridge(
  operatingDoctrineDraft,
  recurringFailureTaxonomy,
  allocationPlaybookIndex
) {
  const failureRows = Array.isArray(recurringFailureTaxonomy) ? recurringFailureTaxonomy : [];
  const playbookRows = Array.isArray(allocationPlaybookIndex) ? allocationPlaybookIndex : [];
  return [
    {
      rung: dashboardCopy("Documented doctrine", "制度已成文"),
      summary:
        operatingDoctrineDraft?.doctrine_core ||
        dashboardCopy("Doctrine is still emerging.", "制度主线仍在形成中。")
    },
    {
      rung: dashboardCopy("Known failure patterns", "失败模式已识别"),
      summary:
        failureRows[0]?.summary ||
        dashboardCopy("Failure patterns are still emerging.", "失败模式仍在形成中。")
    },
    {
      rung: dashboardCopy("Playable institutional guidance", "可执行机构指引"),
      summary:
        playbookRows[0]?.summary ||
        dashboardCopy("Playbook guidance is still emerging.", "手册指引仍在形成中。")
    }
  ];
}

function buildWatchArchiveFailurePreventionChecklistBridge(
  recurringFailureTaxonomy,
  escalationOwnershipMap,
  operatingDoctrineDraft
) {
  const failureRows = Array.isArray(recurringFailureTaxonomy) ? recurringFailureTaxonomy : [];
  const ownershipRows = Array.isArray(escalationOwnershipMap) ? escalationOwnershipMap : [];
  return [
    {
      item: dashboardCopy("Check escalation ownership before breach", "在失守前检查升级归属"),
      summary:
        ownershipRows[0]?.owner_lane ||
        dashboardCopy("No escalation ownership signal yet.", "当前还没有升级归属信号。")
    },
    {
      item: dashboardCopy("Review top recurring failure", "复核首要重复失败模式"),
      summary:
        failureRows[0]?.summary ||
        dashboardCopy("No recurring failure signal yet.", "当前还没有重复失败信号。")
    },
    {
      item: dashboardCopy("Apply doctrine before workaround", "先用制度，再走权宜之计"),
      summary:
        operatingDoctrineDraft?.ownership_rule ||
        dashboardCopy("No doctrine ownership rule yet.", "当前还没有制度归属规则。")
    }
  ];
}

function buildWatchArchiveInstitutionalMemoryShelfBridge(
  portfolioLessonRegister,
  allocationPlaybookIndex,
  governanceNarrativeDraft
) {
  const lessonRows = Array.isArray(portfolioLessonRegister) ? portfolioLessonRegister : [];
  const playbookRows = Array.isArray(allocationPlaybookIndex) ? allocationPlaybookIndex : [];
  return [
    {
      memory: dashboardCopy("Governance memory", "治理记忆"),
      summary:
        governanceNarrativeDraft?.portfolio_story ||
        dashboardCopy("No governance memory yet.", "当前还没有治理记忆。")
    },
    {
      memory: dashboardCopy("Lesson memory", "经验记忆"),
      summary:
        lessonRows[0]?.summary ||
        dashboardCopy("No lesson memory yet.", "当前还没有经验记忆。")
    },
    {
      memory: dashboardCopy("Playbook memory", "手册记忆"),
      summary:
        playbookRows[0]?.summary ||
        dashboardCopy("No playbook memory yet.", "当前还没有手册记忆。")
    }
  ];
}

function buildWatchArchiveGovernanceHealthScoreBridge(
  governanceMaturityLadder,
  failurePreventionChecklist,
  institutionalMemoryShelf
) {
  const maturityCount = Array.isArray(governanceMaturityLadder) ? governanceMaturityLadder.length : 0;
  const preventionCount = Array.isArray(failurePreventionChecklist) ? failurePreventionChecklist.length : 0;
  const memoryCount = Array.isArray(institutionalMemoryShelf) ? institutionalMemoryShelf.length : 0;
  const score = Math.min(100, 40 + maturityCount * 10 + preventionCount * 8 + memoryCount * 6);
  return {
    schema: "cssmv.watch_archive_governance_health_score.v1",
    generated_at: new Date().toISOString(),
    score,
    summary: dashboardCopy(
      `Governance health is currently scored at ${score}/100 based on doctrine, prevention, and memory coverage.`,
      `当前治理健康度评分为 ${score}/100，依据来自制度、预防和记忆覆盖。`
    )
  };
}

function buildWatchArchivePreventionCoverageMapBridge(
  failurePreventionChecklist,
  recurringFailureTaxonomy
) {
  const preventionRows = Array.isArray(failurePreventionChecklist) ? failurePreventionChecklist : [];
  const failureRows = Array.isArray(recurringFailureTaxonomy) ? recurringFailureTaxonomy : [];
  return preventionRows.map((item, index) => ({
    area: item.item,
    coverage: dashboardCopy(
      index < failureRows.length ? "covered" : "partial",
      index < failureRows.length ? "已覆盖" : "部分覆盖"
    ),
    summary: item.summary
  }));
}

function buildWatchArchiveMemoryGapRegisterBridge(
  institutionalMemoryShelf,
  allocationPlaybookIndex,
  governanceNarrativeDraft
) {
  const memoryRows = Array.isArray(institutionalMemoryShelf) ? institutionalMemoryShelf : [];
  const playbookRows = Array.isArray(allocationPlaybookIndex) ? allocationPlaybookIndex : [];
  const gaps = [];
  if (memoryRows.length < 3) {
    gaps.push({
      gap: dashboardCopy("Memory shelf depth", "记忆架深度"),
      summary: dashboardCopy("Institutional memory still needs more archived entries.", "机构记忆仍需要更多归档条目。")
    });
  }
  if (playbookRows.length < 3) {
    gaps.push({
      gap: dashboardCopy("Playbook completeness", "手册完整度"),
      summary: dashboardCopy("Playbook index still has visible gaps.", "手册索引仍存在明显空缺。")
    });
  }
  if (!String(governanceNarrativeDraft?.committee_story || "").trim()) {
    gaps.push({
      gap: dashboardCopy("Governance story continuity", "治理叙事连续性"),
      summary: dashboardCopy(
        "Governance narrative still needs a stronger committee-level story.",
        "治理叙事仍需要更完整的委员会层故事线。"
      )
    });
  }
  return gaps;
}

function buildWatchArchiveGovernanceRoadmapDraftBridge(
  governanceHealthScore,
  preventionCoverageMap,
  memoryGapRegister
) {
  const coverageRows = Array.isArray(preventionCoverageMap) ? preventionCoverageMap : [];
  const gapRows = Array.isArray(memoryGapRegister) ? memoryGapRegister : [];
  return {
    schema: "cssmv.watch_archive_governance_roadmap_draft.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Governance roadmap draft", "治理路线图草稿"),
    current_state: governanceHealthScore?.summary || "",
    next_focus:
      coverageRows[0]?.summary ||
      dashboardCopy("No prevention focus has been inferred yet.", "当前还没有推导出预防重点。"),
    memory_priority:
      gapRows[0]?.summary ||
      dashboardCopy("No memory-priority gap is visible right now.", "当前没有明显的记忆优先缺口。")
  };
}

function buildWatchArchiveCoverageUpliftQueueBridge(
  preventionCoverageMap,
  recurringFailureTaxonomy
) {
  const coverageRows = Array.isArray(preventionCoverageMap) ? preventionCoverageMap : [];
  const failureRows = Array.isArray(recurringFailureTaxonomy) ? recurringFailureTaxonomy : [];
  return coverageRows.map((item, index) => ({
    area: item.area,
    priority: item.coverage === dashboardCopy("covered", "已覆盖") ? "maintain" : "uplift",
    summary: failureRows[index]?.summary || item.summary
  }));
}

function buildWatchArchiveMemoryCaptureBacklogBridge(
  memoryGapRegister,
  institutionalMemoryShelf,
  allocationPlaybookIndex
) {
  const gapRows = Array.isArray(memoryGapRegister) ? memoryGapRegister : [];
  const memoryRows = Array.isArray(institutionalMemoryShelf) ? institutionalMemoryShelf : [];
  const playbookRows = Array.isArray(allocationPlaybookIndex) ? allocationPlaybookIndex : [];
  return [
    ...gapRows.map((item) => ({
      item: item.gap,
      summary: item.summary
    })),
    ...(memoryRows.length
      ? []
      : [{
          item: dashboardCopy("Seed institutional memory", "建立机构记忆种子"),
          summary: dashboardCopy("Capture the first durable governance memory entries.", "先沉淀第一批可长期复用的治理记忆。")
        }]),
    ...(playbookRows.length
      ? []
      : [{
          item: dashboardCopy("Seed playbook memory", "建立手册记忆种子"),
          summary: dashboardCopy("Capture the first reusable playbook entries.", "先沉淀第一批可复用的手册条目。")
        }])
  ];
}

function buildWatchArchiveGovernanceSprintPlannerBridge(
  governanceRoadmapDraft,
  coverageUpliftQueue,
  memoryCaptureBacklog
) {
  const upliftRows = Array.isArray(coverageUpliftQueue) ? coverageUpliftQueue : [];
  const memoryRows = Array.isArray(memoryCaptureBacklog) ? memoryCaptureBacklog : [];
  return {
    schema: "cssmv.watch_archive_governance_sprint_planner.v1",
    generated_at: new Date().toISOString(),
    headline: dashboardCopy("Governance sprint planner", "治理迭代计划器"),
    sprint_goal:
      governanceRoadmapDraft?.next_focus ||
      dashboardCopy("No sprint goal is visible yet.", "当前还没有明显的迭代目标。"),
    uplift_task:
      upliftRows[0]?.summary ||
      dashboardCopy("No uplift task is visible yet.", "当前还没有明显的覆盖提升任务。"),
    memory_task:
      memoryRows[0]?.summary ||
      dashboardCopy("No memory task is visible yet.", "当前还没有明显的记忆补齐任务。")
  };
}

function buildWatchArchiveUpliftRoiTrackerBridge(
  coverageUpliftQueue,
  governanceHealthScore,
  recurringFailureTaxonomy
) {
  const upliftRows = Array.isArray(coverageUpliftQueue) ? coverageUpliftQueue : [];
  const failureRows = Array.isArray(recurringFailureTaxonomy) ? recurringFailureTaxonomy : [];
  const healthScore = Number(governanceHealthScore?.score || 0);
  return upliftRows.map((item, index) => ({
    area: item.area,
    roi_signal: dashboardCopy(
      item.priority === "uplift"
        ? `Higher ROI if coverage work reduces ${failureRows[index]?.failure_type || dashboardCopy("top failure drag", "首要失败拖拽")}.`
        : "Maintain mode; ROI depends on preserving current coverage.",
      item.priority === "uplift"
        ? `如果覆盖提升能削弱${failureRows[index]?.failure_type || dashboardCopy("首要失败拖拽", "首要失败拖拽")}，ROI 会更高。`
        : "当前更适合维持；ROI 取决于是否能守住现有覆盖。"
    ),
    score_hint: dashboardCopy(`Health anchor=${healthScore}/100`, `健康锚点=${healthScore}/100`)
  }));
}

function buildWatchArchiveMemoryCompletionBurndownBridge(
  memoryCaptureBacklog,
  institutionalMemoryShelf
) {
  const backlogRows = Array.isArray(memoryCaptureBacklog) ? memoryCaptureBacklog : [];
  const memoryRows = Array.isArray(institutionalMemoryShelf) ? institutionalMemoryShelf : [];
  const remaining = backlogRows.length;
  const completed = memoryRows.length;
  return {
    schema: "cssmv.watch_archive_memory_completion_burndown.v1",
    generated_at: new Date().toISOString(),
    completed,
    remaining,
    summary: dashboardCopy(
      `Memory completion burn-down = completed ${completed}, remaining ${remaining}.`,
      `记忆补齐燃尽 = 已完成 ${completed}，剩余 ${remaining}。`
    )
  };
}

function buildWatchArchiveGovernanceReleaseGateBridge(
  governanceSprintPlanner,
  upliftRoiTracker,
  memoryCompletionBurndown
) {
  const upliftRows = Array.isArray(upliftRoiTracker) ? upliftRoiTracker : [];
  const remaining = Number(memoryCompletionBurndown?.remaining || 0);
  const passed = upliftRows.length > 0 && remaining === 0;
  return {
    schema: "cssmv.watch_archive_governance_release_gate.v1",
    generated_at: new Date().toISOString(),
    state: passed ? "ready" : "hold",
    summary: passed
      ? dashboardCopy(
          "Governance release gate is ready because uplift tracking exists and memory backlog is clear.",
          "治理发布门已就绪，因为覆盖提升追踪存在且记忆待办已清空。"
        )
      : dashboardCopy(
          "Governance release gate stays on hold until uplift and memory completion are strong enough.",
          "在覆盖提升和记忆补齐足够扎实之前，治理发布门保持待定。"
        ),
    sprint_reference: governanceSprintPlanner?.sprint_goal || ""
  };
}

window.buildWatchArchiveGovernanceMaturityLadderBridge = buildWatchArchiveGovernanceMaturityLadderBridge;
window.buildWatchArchiveFailurePreventionChecklistBridge = buildWatchArchiveFailurePreventionChecklistBridge;
window.buildWatchArchiveInstitutionalMemoryShelfBridge = buildWatchArchiveInstitutionalMemoryShelfBridge;
window.buildWatchArchiveGovernanceHealthScoreBridge = buildWatchArchiveGovernanceHealthScoreBridge;
window.buildWatchArchivePreventionCoverageMapBridge = buildWatchArchivePreventionCoverageMapBridge;
window.buildWatchArchiveMemoryGapRegisterBridge = buildWatchArchiveMemoryGapRegisterBridge;
window.buildWatchArchiveGovernanceRoadmapDraftBridge = buildWatchArchiveGovernanceRoadmapDraftBridge;
window.buildWatchArchiveCoverageUpliftQueueBridge = buildWatchArchiveCoverageUpliftQueueBridge;
window.buildWatchArchiveMemoryCaptureBacklogBridge = buildWatchArchiveMemoryCaptureBacklogBridge;
window.buildWatchArchiveGovernanceSprintPlannerBridge = buildWatchArchiveGovernanceSprintPlannerBridge;
window.buildWatchArchiveUpliftRoiTrackerBridge = buildWatchArchiveUpliftRoiTrackerBridge;
window.buildWatchArchiveMemoryCompletionBurndownBridge = buildWatchArchiveMemoryCompletionBurndownBridge;
window.buildWatchArchiveGovernanceReleaseGateBridge = buildWatchArchiveGovernanceReleaseGateBridge;
