pub fn diff_runs(
    req: crate::runtime_diff::types::BranchDiffRequest,
) -> anyhow::Result<crate::runtime_diff::types::BranchDiffResult> {
    let left_events = crate::runtime_replay::storage::load_runtime_events(&req.left.run_id)?;
    let right_events = crate::runtime_replay::storage::load_runtime_events(&req.right.run_id)?;
    let left_snapshot = crate::run_store::load_film_runtime_snapshot(&req.left.run_id)?;
    let right_snapshot = crate::run_store::load_film_runtime_snapshot(&req.right.run_id)?;
    Ok(crate::runtime_diff::branch_diff::build_branch_diff(
        req,
        &left_events,
        &right_events,
        &left_snapshot,
        &right_snapshot,
    ))
}

pub fn diff_endings(
    left_run_id: &str,
    right_run_id: &str,
) -> anyhow::Result<crate::runtime_diff::types::EndingDiffResult> {
    let left_snapshot = crate::run_store::load_film_runtime_snapshot(left_run_id)?;
    let right_snapshot = crate::run_store::load_film_runtime_snapshot(right_run_id)?;
    Ok(crate::runtime_diff::ending_diff::build_ending_diff(
        left_run_id.to_string(),
        right_run_id.to_string(),
        &left_snapshot,
        &right_snapshot,
    ))
}
