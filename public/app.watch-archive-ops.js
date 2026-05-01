function buildWatchArchiveGovernanceSearchIndexBridge(
  governanceDossierNavigator,
  auditRetrievalShelf,
  governanceNarrativeDraft
) {
  const navigatorRows = Array.isArray(governanceDossierNavigator) ? governanceDossierNavigator : [];
  const shelfRows = Array.isArray(auditRetrievalShelf) ? auditRetrievalShelf : [];
  const tokens = [
    ...navigatorRows.map((item) => `${item.node} ${item.summary}`),
    ...shelfRows.map((item) => `${item.slot} ${item.summary}`),
    governanceNarrativeDraft?.headline || "",
    governanceNarrativeDraft?.committee_story || "",
    governanceNarrativeDraft?.escalation_story || "",
    governanceNarrativeDraft?.portfolio_story || ""
  ]
    .filter(Boolean)
    .join(" | ");
  return {
    schema: "cssmv.watch_archive_governance_search_index.v1",
    generated_at: new Date().toISOString(),
    indexed_terms: tokens
  };
}

function buildWatchArchiveDependencyRiskScannerBridge(
  approvalDependencyGraph,
  governanceSignoffLane,
  evidenceTraceMatrix
) {
  const dependencyRows = Array.isArray(approvalDependencyGraph) ? approvalDependencyGraph : [];
  const signoffRows = Array.isArray(governanceSignoffLane) ? governanceSignoffLane : [];
  const traceRows = Array.isArray(evidenceTraceMatrix) ? evidenceTraceMatrix : [];
  return dependencyRows.map((item) => ({
    approver: item.approver,
    risk: dashboardCopy(
      traceRows.length < signoffRows.length || !item.evidence_edge ? "watch" : "stable",
      traceRows.length < signoffRows.length || !item.evidence_edge ? "观察" : "稳定"
    ),
    summary: dashboardCopy(
      `Dependency risk is tied to ${item.depends_on} and evidence edge ${item.evidence_edge}.`,
      `依赖风险绑定在 ${item.depends_on} 与证据边 ${item.evidence_edge} 上。`
    )
  }));
}

function buildWatchArchiveAuditQueryPresetsBridge(
  auditRetrievalShelf,
  auditArchiveIndex,
  evidenceTraceMatrix
) {
  const shelfRows = Array.isArray(auditRetrievalShelf) ? auditRetrievalShelf : [];
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  const traceRows = Array.isArray(evidenceTraceMatrix) ? evidenceTraceMatrix : [];
  return [
    {
      label: dashboardCopy("Latest audit trail", "最新审计链"),
      query: archiveRows[0]?.title || dashboardCopy("Audit archive latest", "审计档案最新项")
    },
    {
      label: dashboardCopy("Evidence trace focus", "证据追踪重点"),
      query: traceRows[0]?.source || dashboardCopy("Evidence trace", "证据追踪")
    },
    {
      label: dashboardCopy("Retrieval shelf focus", "检索架重点"),
      query: shelfRows[0]?.slot || dashboardCopy("Audit retrieval", "审计检索")
    }
  ];
}

function buildWatchArchiveGovernanceCommandPaletteBridge(
  governanceSearchIndex,
  auditQueryPresets,
  governanceDossierNavigator
) {
  const presetRows = Array.isArray(auditQueryPresets) ? auditQueryPresets : [];
  const navigatorRows = Array.isArray(governanceDossierNavigator) ? governanceDossierNavigator : [];
  return [
    {
      action: dashboardCopy("Open latest audit trail", "打开最新审计链"),
      target: presetRows[0]?.query || dashboardCopy("Audit archive latest", "审计档案最新项"),
      reason: dashboardCopy(
        "Fastest path into the newest governance evidence trail.",
        "这是进入最新治理证据链的最快入口。"
      )
    },
    {
      action: dashboardCopy("Jump to trace focus", "跳转到追踪重点"),
      target: presetRows[1]?.query || dashboardCopy("Evidence trace", "证据追踪"),
      reason: dashboardCopy(
        "Best starting point when approval evidence needs quick validation.",
        "当审批证据需要快速核对时，这是最好的起点。"
      )
    },
    {
      action: dashboardCopy("Navigate dossier root", "导航到卷宗根节点"),
      target: navigatorRows[0]?.node || dashboardCopy("Release dossier root", "放行卷宗根节点"),
      reason: dashboardCopy(
        "Useful when the operator needs the top-level release context first.",
        "当操作人需要先看放行全局上下文时，这个入口最合适。"
      )
    }
  ];
}

function buildWatchArchiveRiskTriageQueueBridge(
  dependencyRiskScanner,
  approvalDependencyGraph,
  governanceSignoffLane
) {
  const riskRows = Array.isArray(dependencyRiskScanner) ? dependencyRiskScanner : [];
  const dependencyRows = Array.isArray(approvalDependencyGraph) ? approvalDependencyGraph : [];
  const signoffRows = Array.isArray(governanceSignoffLane) ? governanceSignoffLane : [];
  return riskRows
    .map((item, index) => {
      const dependency = dependencyRows[index] || {};
      const signoff = signoffRows[index] || {};
      const priority = item.risk === dashboardCopy("watch", "观察") ? "P1" : "P3";
      return {
        approver: item.approver || dependency.approver || `approver-${index + 1}`,
        priority,
        blocker:
          dependency.depends_on ||
          signoff.signer ||
          dashboardCopy("approval evidence gap", "审批证据缺口"),
        next_action: dashboardCopy(
          priority === "P1"
            ? "Validate evidence edge and confirm signer path first."
            : "Keep watching the dependency and reopen only if the evidence weakens.",
          priority === "P1" ? "先核验证据边，再确认签发路径。" : "先持续观察依赖链，只有证据变弱时再升级处理。"
        )
      };
    })
    .sort((a, b) => a.priority.localeCompare(b.priority));
}

function buildWatchArchiveAuditQuickOpenSetBridge(
  auditQueryPresets,
  auditRetrievalShelf,
  auditArchiveIndex
) {
  const presetRows = Array.isArray(auditQueryPresets) ? auditQueryPresets : [];
  const shelfRows = Array.isArray(auditRetrievalShelf) ? auditRetrievalShelf : [];
  const archiveRows = Array.isArray(auditArchiveIndex) ? auditArchiveIndex : [];
  return [
    {
      label: dashboardCopy("Quick-open latest archive", "快速打开最新档案"),
      target: archiveRows[0]?.title || dashboardCopy("Audit archive latest", "审计档案最新项")
    },
    {
      label: dashboardCopy("Quick-open retrieval shelf", "快速打开检索架"),
      target: shelfRows[0]?.slot || dashboardCopy("Audit retrieval", "审计检索")
    },
    {
      label: dashboardCopy("Quick-open preset focus", "快速打开预设重点"),
      target: presetRows[0]?.query || dashboardCopy("Latest audit trail", "最新审计链")
    }
  ];
}

function buildWatchArchiveSavedOperatorMacrosBridge(
  governanceCommandPalette,
  auditQuickOpenSet,
  riskTriageQueue
) {
  const paletteRows = Array.isArray(governanceCommandPalette) ? governanceCommandPalette : [];
  const quickOpenRows = Array.isArray(auditQuickOpenSet) ? auditQuickOpenSet : [];
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  return [
    {
      macro: dashboardCopy("Open latest + trace focus", "打开最新项并聚焦追踪"),
      steps: [paletteRows[0]?.action, paletteRows[1]?.action].filter(Boolean),
      result: dashboardCopy(
        "Use this when the operator wants the shortest path into current audit evidence.",
        "当操作人需要最快进入当前审计证据时，优先用这个宏。"
      )
    },
    {
      macro: dashboardCopy("Triage first blocker", "先分诊第一阻塞"),
      steps: [
        triageRows[0] ? `${triageRows[0].priority} · ${triageRows[0].approver}` : dashboardCopy("No priority blocker yet", "当前还没有优先阻塞"),
        quickOpenRows[0]?.label
      ].filter(Boolean),
      result: dashboardCopy(
        "Best for the first response pass when a dependency looks fragile.",
        "当依赖链看起来脆弱时，适合作为第一轮响应。"
      )
    }
  ];
}

function buildWatchArchiveTriageEscalationShortcutsBridge(
  riskTriageQueue,
  dependencyRiskScanner,
  approvalDependencyGraph
) {
  const triageRows = Array.isArray(riskTriageQueue) ? riskTriageQueue : [];
  const riskRows = Array.isArray(dependencyRiskScanner) ? dependencyRiskScanner : [];
  const dependencyRows = Array.isArray(approvalDependencyGraph) ? approvalDependencyGraph : [];
  return triageRows.slice(0, 3).map((item, index) => ({
    label: dashboardCopy(`Escalate ${item.approver}`, `升级处理 ${item.approver}`),
    route: dependencyRows[index]?.depends_on || item.blocker,
    severity:
      item.priority === "P1" ? dashboardCopy("fast-track", "快速通道") : dashboardCopy("watch-path", "观察路径"),
    note: dashboardCopy(
      riskRows[index]?.risk === dashboardCopy("watch", "观察")
        ? "Escalate through the shortest approval path and keep evidence visible."
        : "Keep this in a lighter escalation path unless the evidence edge weakens.",
      riskRows[index]?.risk === dashboardCopy("watch", "观察")
        ? "通过最短审批路径升级，并保持证据可见。"
        : "除非证据边变弱，否则先放在较轻的升级路径里。"
    )
  }));
}

window.buildWatchArchiveGovernanceSearchIndexBridge = buildWatchArchiveGovernanceSearchIndexBridge;
window.buildWatchArchiveDependencyRiskScannerBridge = buildWatchArchiveDependencyRiskScannerBridge;
window.buildWatchArchiveAuditQueryPresetsBridge = buildWatchArchiveAuditQueryPresetsBridge;
window.buildWatchArchiveGovernanceCommandPaletteBridge = buildWatchArchiveGovernanceCommandPaletteBridge;
window.buildWatchArchiveRiskTriageQueueBridge = buildWatchArchiveRiskTriageQueueBridge;
window.buildWatchArchiveAuditQuickOpenSetBridge = buildWatchArchiveAuditQuickOpenSetBridge;
window.buildWatchArchiveSavedOperatorMacrosBridge = buildWatchArchiveSavedOperatorMacrosBridge;
window.buildWatchArchiveTriageEscalationShortcutsBridge = buildWatchArchiveTriageEscalationShortcutsBridge;
