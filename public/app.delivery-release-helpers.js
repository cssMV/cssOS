function signedApproverRolesBridge(trace) {
  return Array.isArray(trace?.signed_approvers)
    ? trace.signed_approvers
        .map((item) => String(item?.actor_role || "").trim().toLowerCase())
        .filter(Boolean)
    : [];
}

function missingRequiredSignerRolesBridge(trace) {
  const required = Array.isArray(trace?.required_signers)
    ? trace.required_signers.map((item) => String(item || "").trim().toLowerCase()).filter(Boolean)
    : [];
  const signed = new Set(signedApproverRolesBridge(trace));
  return required.filter((role) => !signed.has(role));
}

function normalizeActorDirectoryEntriesBridge(directoryValue) {
  if (Array.isArray(directoryValue?.directory)) return directoryValue.directory;
  if (Array.isArray(directoryValue)) return directoryValue;
  return [];
}

function findSuggestedActorForRoleBridge(directoryValue, role, fallbackActor) {
  const normalizedRole = String(role || "").trim().toLowerCase();
  if (!normalizedRole) return null;
  const directory = normalizeActorDirectoryEntriesBridge(directoryValue);
  const matched = directory.find(
    (entry) => String(entry?.actor_role || "").trim().toLowerCase() === normalizedRole
  );
  if (matched) return matched;
  if (
    fallbackActor &&
    String(fallbackActor?.actor_role || "").trim().toLowerCase() === normalizedRole
  ) {
    return fallbackActor;
  }
  return null;
}

function blockerSpecificPublishCopyBridge(missingSteps) {
  const steps = Array.isArray(missingSteps) ? missingSteps : [];
  if (steps.includes("unlock_publish_gate")) {
    return dashboardCopy(
      "Publish is blocked because the gate has not been unlocked yet. Finish the release quorum check after the required signers approve.",
      "当前发布被拦住，是因为发布门还没解锁。请先完成必需签发，再执行最终 quorum 检查。"
    );
  }
  if (steps.includes("issue_release_unblock_token")) {
    return dashboardCopy(
      "Publish is blocked because no unblock token has been issued yet. Run the final gate step to mint the publish token.",
      "当前发布被拦住，是因为还没有签发放行 token。请执行最终门禁步骤来生成发布 token。"
    );
  }
  if (steps.includes("grant_immutable_publish_authorization")) {
    return dashboardCopy(
      "Publish is blocked because immutable publish authorization is still missing. Complete the approval-to-publish chain first.",
      "当前发布被拦住，是因为还缺少不可变发布授权。请先完成发布审批链。"
    );
  }
  if (steps.includes("authorization_revision_mismatch") || steps.includes("authorization_candidate_mismatch")) {
    return dashboardCopy(
      "Publish is blocked because the authorization belongs to a different revision or candidate. Re-run the release gate on the chosen revision.",
      "当前发布被拦住，是因为现有授权对应的是别的 revision 或 candidate。请对当前选定版本重新执行发布门禁。"
    );
  }
  return dashboardCopy(
    "Publish is blocked until the remaining release checks turn green.",
    "当前发布仍被拦截，直到剩余发布检查全部变绿。"
  );
}

window.signedApproverRolesBridge = signedApproverRolesBridge;
window.missingRequiredSignerRolesBridge = missingRequiredSignerRolesBridge;
window.normalizeActorDirectoryEntriesBridge = normalizeActorDirectoryEntriesBridge;
window.findSuggestedActorForRoleBridge = findSuggestedActorForRoleBridge;
window.blockerSpecificPublishCopyBridge = blockerSpecificPublishCopyBridge;
