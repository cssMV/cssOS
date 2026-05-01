function buildPublishSimulationBridge(readinessChecklist, missingSignerRoles, suggestedRole, suggestedActor) {
  const allReady = readinessChecklist.every((item) => item.ready);
  const nextActions = [];
  if (missingSignerRoles.length) {
    nextActions.push(
      dashboardCopy(
        `Collect sign-off from ${missingSignerRoles[0]}${suggestedActor ? ` via ${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}.`,
        `先收集 ${missingSignerRoles[0]} 的签发${suggestedActor ? `，建议人：${suggestedActor.actor_name || suggestedActor.actor_id}` : ""}。`
      )
    );
  }
  if (!readinessChecklist.find((item) => item.id === "quorum")?.ready) {
    nextActions.push(
      dashboardCopy(
        "Run the final publish gate check to unlock gate, token, and authorization.",
        "执行最终发布门禁检查，解锁 gate、token 和 authorization。"
      )
    );
  }
  if (allReady) {
    nextActions.push(
      dashboardCopy(
        "All checks are green. The next manual step is to publish the locked revision.",
        "所有检查都已变绿。下一步只需人工确认并发布锁定版本。"
      )
    );
  }
  return {
    schema: "cssmv.publish_simulation.v1",
    ready: allReady,
    suggested_role: suggestedRole || null,
    suggested_actor: suggestedActor || null,
    pending_items: readinessChecklist.filter((item) => !item.ready).map((item) => item.id),
    next_actions: nextActions
  };
}

function estimatePublishOutcomeBridge(readinessChecklist, blockedPublishExplainer, missingSignerRoles) {
  const pendingCount = Array.isArray(readinessChecklist)
    ? readinessChecklist.filter((item) => !item.ready).length
    : 0;
  const missingSteps = Array.isArray(blockedPublishExplainer?.missing_steps)
    ? blockedPublishExplainer.missing_steps
    : [];
  if (pendingCount === 0) {
    return {
      state: "clear_to_publish",
      summary: dashboardCopy(
        "If you publish now, the current release gate should pass and the locked revision can move into formal handoff.",
        "如果你现在发布，当前发布门禁预计会放行，这个锁定版本可以进入正式交付。"
      )
    };
  }
  if (missingSteps.includes("authorization_revision_mismatch") || missingSteps.includes("authorization_candidate_mismatch")) {
    return {
      state: "authorization_mismatch",
      summary: dashboardCopy(
        "If you publish now, it will fail on authorization mismatch and you will need to rerun the gate on the chosen revision.",
        "如果你现在发布，会因为授权对象不匹配而失败，你需要先对当前选定版本重新执行门禁。"
      )
    };
  }
  if (missingSignerRoles.length) {
    return {
      state: "awaiting_signers",
      summary: dashboardCopy(
        `If you publish now, it will still be blocked because signer roles ${missingSignerRoles.join(", ")} have not approved yet.`,
        `如果你现在发布，仍会被拦住，因为 ${missingSignerRoles.join("、")} 这些签发角色还没有完成审批。`
      )
    };
  }
  return {
    state: "blocked_by_gate",
    summary: dashboardCopy(
      "If you publish now, it will still be blocked by the remaining gate checks.",
      "如果你现在发布，仍会被剩余的门禁检查拦住。"
    )
  };
}

window.buildPublishSimulationBridge = buildPublishSimulationBridge;
window.estimatePublishOutcomeBridge = estimatePublishOutcomeBridge;
