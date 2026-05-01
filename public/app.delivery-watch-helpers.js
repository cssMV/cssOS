function forecastApprovalSlaBridge(complianceClock, missingSignerRoles, approvalToPublishTrace) {
  const windows = Array.isArray(complianceClock?.windows) ? complianceClock.windows : [];
  const approvalWindow = windows.find((window) => String(window?.id || "").includes("ack")) || windows[0] || null;
  if (!missingSignerRoles.length) {
    return {
      label: dashboardCopy("Approval SLA forecast", "审批 SLA 预测"),
      summary: dashboardCopy(
        "All required signers are already in. Approval-side wait time is effectively near zero.",
        "所有必需签发人都已到位。审批侧等待时间基本接近于零。"
      )
    };
  }
  const remainingSec = Number(approvalWindow?.remaining_s || 0);
  const targetSec = Number(approvalWindow?.target_s || 0);
  const quorumMet = !!approvalToPublishTrace?.quorum_met;
  return {
    label: dashboardCopy("Approval SLA forecast", "审批 SLA 预测"),
    summary: dashboardCopy(
      `Still waiting on ${missingSignerRoles.join(", ")}. Estimated remaining SLA window: ${remainingSec}s out of ${targetSec}s.${quorumMet ? " Quorum is already met." : ""}`,
      `仍在等待 ${missingSignerRoles.join("、")}。预计剩余 SLA 窗口约为 ${remainingSec} 秒，总目标为 ${targetSec} 秒。${quorumMet ? " 当前 quorum 已达成。" : ""}`
    )
  };
}

function buildReleaseRiskBannerBridge(readinessChecklist, complianceFlags, complianceClock, blockedPublishExplainer) {
  const pendingCount = Array.isArray(readinessChecklist)
    ? readinessChecklist.filter((item) => !item.ready).length
    : 0;
  const flagCount = Array.isArray(complianceFlags) ? complianceFlags.length : 0;
  const breachedWindow = Array.isArray(complianceClock?.windows)
    ? complianceClock.windows.find((window) => String(window?.status || "").toLowerCase() === "breached")
    : null;
  let level = "low";
  if (pendingCount >= 3 || flagCount >= 2) level = "medium";
  if (blockedPublishExplainer?.blocked && (pendingCount >= 4 || breachedWindow)) level = "high";
  return {
    level,
    summary:
      level === "high"
        ? dashboardCopy(
            "High release risk: multiple publish gates are still pending or an SLA window is already breached.",
            "高发布风险：当前仍有多项发布门禁未完成，或者已经出现 SLA 超时。"
          )
        : level === "medium"
          ? dashboardCopy(
              "Medium release risk: the publish path is recoverable, but several checks are still pending.",
              "中等发布风险：当前发布路径仍可恢复，但还有多项检查待完成。"
            )
          : dashboardCopy(
              "Low release risk: the publish path looks stable, with only minor or no blockers remaining.",
              "低发布风险：当前发布路径整体稳定，仅剩很少或没有阻塞。"
            )
  };
}

function buildPostPublishWatchlistBridge(complianceFlags, complianceClock, releaseRiskBanner) {
  const items = [];
  const flags = Array.isArray(complianceFlags) ? complianceFlags : [];
  const windows = Array.isArray(complianceClock?.windows) ? complianceClock.windows : [];
  flags.slice(0, 3).forEach((flag) => {
    items.push(
      dashboardCopy(
        `Watch exception flag ${String(flag?.title || flag?.code || "unknown")} after publish.`,
        `发布后重点关注异常标记 ${String(flag?.title || flag?.code || "未知项")}。`
      )
    );
  });
  windows
    .filter((window) => ["tracking", "breached"].includes(String(window?.status || "").toLowerCase()))
    .slice(0, 2)
    .forEach((window) => {
      items.push(
        dashboardCopy(
          `Track SLA window ${String(window?.label || window?.id || "SLA")} until it closes.`,
          `持续跟踪 SLA 窗口 ${String(window?.label || window?.id || "SLA")}，直到它真正关闭。`
        )
      );
    });
  if (!items.length) {
    items.push(
      releaseRiskBanner.level === "low"
        ? dashboardCopy(
            "Post-publish watchlist is light: confirm the publish receipt and downstream acknowledgment.",
            "发布后观察清单较轻：确认发布回执和下游确认即可。"
          )
        : dashboardCopy(
            "Post-publish watchlist should stay active until the compliance dashboard turns quiet.",
            "发布后仍需持续观察，直到合规模块明显回归平稳。"
          )
    );
  }
  return items;
}

window.forecastApprovalSlaBridge = forecastApprovalSlaBridge;
window.buildReleaseRiskBannerBridge = buildReleaseRiskBannerBridge;
window.buildPostPublishWatchlistBridge = buildPostPublishWatchlistBridge;
