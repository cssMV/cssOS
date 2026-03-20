pub fn build_divergence_point(
    left_events: &[crate::event_engine::types::EngineEvent],
    right_events: &[crate::event_engine::types::EngineEvent],
    prefix: usize,
) -> crate::runtime_diff::types::BranchDivergencePoint {
    let left_ev = left_events.get(prefix);
    let right_ev = right_events.get(prefix);
    crate::runtime_diff::types::BranchDivergencePoint {
        event_index: Some(prefix),
        left_event_kind: left_ev.map(|e| format!("{:?}", e.kind).to_lowercase()),
        right_event_kind: right_ev.map(|e| format!("{:?}", e.kind).to_lowercase()),
        left_story_node: left_ev
            .and_then(|e| e.payload.get("node_id"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
        right_story_node: right_ev
            .and_then(|e| e.payload.get("node_id"))
            .and_then(|x| x.as_str())
            .map(|s| s.to_string()),
    }
}

pub fn build_branch_diff(
    req: crate::runtime_diff::types::BranchDiffRequest,
    left_events: &[crate::event_engine::types::EngineEvent],
    right_events: &[crate::event_engine::types::EngineEvent],
    left_snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
    right_snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> crate::runtime_diff::types::BranchDiffResult {
    let prefix = crate::runtime_diff::compare::shared_prefix_len(left_events, right_events);
    let divergence = build_divergence_point(left_events, right_events, prefix);
    let left_ending = crate::runtime_diff::compare::extract_ending_id(left_snapshot);
    let right_ending = crate::runtime_diff::compare::extract_ending_id(right_snapshot);
    let changed_fields =
        crate::runtime_diff::compare::diff_snapshot_fields(left_snapshot, right_snapshot);

    crate::runtime_diff::types::BranchDiffResult {
        left: req.left,
        right: req.right,
        summary: crate::runtime_diff::types::RuntimeDiffSummary {
            shared_prefix_events: Some(prefix),
            same_ending: left_ending == right_ending,
            left_ending,
            right_ending,
        },
        divergence,
        changed_fields,
    }
}
