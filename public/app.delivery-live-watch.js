function buildLiveWatchSessionBridge(arrangementPublishedRevision, releaseRiskBanner, complianceFlags, complianceClock) {
  const windows = Array.isArray(complianceClock?.windows) ? complianceClock.windows : [];
  const activeWindowCount = windows.filter((window) =>
    ["tracking", "breached"].includes(String(window?.status || "").toLowerCase())
  ).length;
  return {
    active: !!arrangementPublishedRevision,
    summary: arrangementPublishedRevision
      ? dashboardCopy(
          `Live watch is active for ${arrangementPublishedRevision.candidate_name || arrangementPublishedRevision.version_name || arrangementPublishedRevision.revision_id}. Risk=${releaseRiskBanner.level}. Active watch windows=${activeWindowCount}. Flags=${Array.isArray(complianceFlags) ? complianceFlags.length : 0}.`,
          `实时观察已开启，目标版本为 ${arrangementPublishedRevision.candidate_name || arrangementPublishedRevision.version_name || arrangementPublishedRevision.revision_id}。风险=${releaseRiskBanner.level}。活动观察窗口=${activeWindowCount}。异常标记=${Array.isArray(complianceFlags) ? complianceFlags.length : 0}。`
        )
      : dashboardCopy(
          "Live watch will start after a revision is formally published.",
          "正式发布某个 revision 之后，这里的实时观察才会真正启动。"
        )
  };
}

function buildAnomalyCheckpointsBridge(complianceFlags, complianceClock, postPublishWatchlist) {
  const checkpoints = [];
  const flags = Array.isArray(complianceFlags) ? complianceFlags : [];
  const windows = Array.isArray(complianceClock?.windows) ? complianceClock.windows : [];
  flags.slice(0, 2).forEach((flag) => {
    checkpoints.push({
      label: dashboardCopy("Exception checkpoint", "异常检查点"),
      detail: dashboardCopy(
        `Verify whether ${String(flag?.title || flag?.code || "the exception flag")} is clearing or escalating.`,
        `确认 ${String(flag?.title || flag?.code || "该异常标记")} 是在缓解还是在升级。`
      )
    });
  });
  windows
    .filter((window) => ["tracking", "breached"].includes(String(window?.status || "").toLowerCase()))
    .slice(0, 2)
    .forEach((window) => {
      checkpoints.push({
        label: dashboardCopy("SLA checkpoint", "SLA 检查点"),
        detail: dashboardCopy(
          `Check ${String(window?.label || window?.id || "the SLA window")} before the remaining window reaches zero.`,
          `在剩余时间归零前，检查 ${String(window?.label || window?.id || "该 SLA 窗口")}。`
        )
      });
    });
  if (!checkpoints.length) {
    postPublishWatchlist.slice(0, 2).forEach((item) => {
      checkpoints.push({
        label: dashboardCopy("Watch checkpoint", "观察检查点"),
        detail: item
      });
    });
  }
  return checkpoints;
}

function buildRollbackRecommendationLaneBridge(
  arrangementPublishedRevision,
  arrangementRevisions,
  releaseRiskBanner,
  complianceFlags,
  complianceClock
) {
  const flags = Array.isArray(complianceFlags) ? complianceFlags : [];
  const breached = Array.isArray(complianceClock?.windows)
    ? complianceClock.windows.some((window) => String(window?.status || "").toLowerCase() === "breached")
    : false;
  const recommendRollback = !!arrangementPublishedRevision && (releaseRiskBanner.level === "high" || breached || flags.length >= 3);
  const fallbackRevision =
    arrangementRevisions.find(
      (entry) => entry.revision_id && entry.revision_id !== arrangementPublishedRevision?.revision_id
    ) || null;
  return {
    recommendRollback,
    fallbackRevision,
    summary: recommendRollback
      ? dashboardCopy(
          `Rollback is recommended if the published revision keeps showing high-risk signals.${fallbackRevision ? ` Nearest fallback: ${fallbackRevision.version_name || fallbackRevision.revision_id}.` : ""}`,
          `如果当前已发布版本继续维持高风险信号，建议回滚。${fallbackRevision ? ` 最近的回退目标是 ${fallbackRevision.version_name || fallbackRevision.revision_id}。` : ""}`
        )
      : dashboardCopy(
          "Rollback is not recommended right now. Keep monitoring the current publish session.",
          "当前还不建议回滚，请继续观察本次发布会话。"
        )
  };
}

function buildTimedFollowupPromptBridge(liveWatchSession, anomalyCheckpoints, releaseRiskBanner) {
  if (!liveWatchSession?.active) {
    return dashboardCopy(
      "Timed follow-up prompts will begin after a revision is published and live watch is started.",
      "当 revision 发布并开启实时观察后，这里会开始出现定时 follow-up 提示。"
    );
  }
  if (releaseRiskBanner?.level === "high") {
    return dashboardCopy(
      `Follow up within 5 minutes and re-check ${anomalyCheckpoints[0]?.label || "the highest-priority checkpoint"} first.`,
      `请在 5 分钟内进行下一次跟进，并优先复查 ${anomalyCheckpoints[0]?.label || "最高优先级检查点"}。`
    );
  }
  if (releaseRiskBanner?.level === "medium") {
    return dashboardCopy(
      `Follow up within 15 minutes and verify ${anomalyCheckpoints[0]?.label || "the next checkpoint"}.`,
      `请在 15 分钟内进行下一次跟进，并确认 ${anomalyCheckpoints[0]?.label || "下一项检查点"}。`
    );
  }
  return dashboardCopy(
    "Follow up within 30 minutes to confirm receipts, acknowledgments, and quiet dashboards remain stable.",
    "请在 30 分钟内再次跟进，确认回执、确认单和安静状态仍保持稳定。"
  );
}

window.buildLiveWatchSessionBridge = buildLiveWatchSessionBridge;
window.buildAnomalyCheckpointsBridge = buildAnomalyCheckpointsBridge;
window.buildRollbackRecommendationLaneBridge = buildRollbackRecommendationLaneBridge;
window.buildTimedFollowupPromptBridge = buildTimedFollowupPromptBridge;
