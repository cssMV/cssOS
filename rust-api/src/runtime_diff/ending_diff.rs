pub fn build_ending_diff(
    left_run_id: String,
    right_run_id: String,
    left_snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
    right_snapshot: &crate::film_runtime::snapshot::FilmRuntimeSnapshot,
) -> crate::runtime_diff::types::EndingDiffResult {
    let left_ending = crate::runtime_diff::compare::extract_ending_id(left_snapshot);
    let right_ending = crate::runtime_diff::compare::extract_ending_id(right_snapshot);
    let mut changed_dimensions = Vec::new();
    if left_snapshot.current_story_node != right_snapshot.current_story_node {
        changed_dimensions.push("story_node".into());
    }
    if left_snapshot.current_scene != right_snapshot.current_scene {
        changed_dimensions.push("scene".into());
    }
    if left_snapshot.camera_mode != right_snapshot.camera_mode {
        changed_dimensions.push("camera".into());
    }
    if left_snapshot.presence_kind != right_snapshot.presence_kind {
        changed_dimensions.push("presence".into());
    }
    crate::runtime_diff::types::EndingDiffResult {
        left_run_id,
        right_run_id,
        left_ending: left_ending.clone(),
        right_ending: right_ending.clone(),
        same: left_ending == right_ending,
        changed_dimensions,
    }
}
