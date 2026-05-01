function buildMusicDeliveryPatchBundleStateBridge(input = {}) {
  const rewritePatchBundle = input.rewritePatchBundle || {};
  const rewriteBundleDiffs = Array.isArray(input.rewriteBundleDiffs) ? input.rewriteBundleDiffs : [];
  const arrangementRevisions = Array.isArray(input.arrangementRevisions) ? input.arrangementRevisions : [];
  const arrangementRevisionHead = input.arrangementRevisionHead || null;
  const arrangementLockedRevision = input.arrangementLockedRevision || null;
  const arrangementPublishedRevision = input.arrangementPublishedRevision || null;
  const arrangementRevisionDiffs = Array.isArray(input.arrangementRevisionDiffs)
    ? input.arrangementRevisionDiffs
    : [];

  const patchBundleJson = JSON.stringify(
    deliveryDashboardState.rewritePatchBundle || rewritePatchBundle,
    null,
    2
  );
  const focusedDiff =
    rewriteBundleDiffs.find(
      (diff) =>
        `${diff.from_bundle_id}->${diff.to_bundle_id}` === deliveryDashboardState.rewriteBundleDiffFocus
    ) || null;
  const focusedRevision =
    arrangementRevisions.find(
      (entry) => entry.revision_id === deliveryDashboardState.arrangementRevisionFocus
    ) ||
    arrangementRevisionHead ||
    arrangementRevisions[0] ||
    null;
  const releaseCandidateInputValue = String(
    deliveryDashboardState.arrangementReleaseCandidateName ||
      focusedRevision?.version_name ||
      arrangementLockedRevision?.candidate_name ||
      ""
  );
  const focusedRevisionDiff =
    arrangementRevisionDiffs.find(
      (diff) =>
        diff.to_revision_id === (focusedRevision?.revision_id || "") ||
        diff.from_revision_id === (focusedRevision?.revision_id || "")
    ) || null;
  const publishCandidateId =
    arrangementLockedRevision?.candidate_id || arrangementPublishedRevision?.candidate_id || "";

  return {
    patchBundleJson,
    focusedDiff,
    focusedRevision,
    releaseCandidateInputValue,
    focusedRevisionDiff,
    publishCandidateId
  };
}

window.buildMusicDeliveryPatchBundleStateBridge =
  buildMusicDeliveryPatchBundleStateBridge;
