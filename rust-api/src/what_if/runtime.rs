pub fn simulate_and_diff(
    req: crate::what_if::types::WhatIfRequest,
) -> anyhow::Result<crate::what_if::types::WhatIfComparison> {
    let result = crate::what_if::simulator::simulate_what_if(req.clone())?;
    let original_snapshot = crate::run_store::load_film_runtime_snapshot(&req.run_id)?;
    let original_events = crate::runtime_replay::storage::load_runtime_events(&req.run_id)?;
    let simulated_events =
        crate::what_if::injection::apply_injection(&original_events, &req.injection);
    let diff = crate::runtime_diff::branch_diff::build_branch_diff(
        crate::runtime_diff::types::BranchDiffRequest {
            left: crate::runtime_diff::types::DiffTarget {
                run_id: req.run_id.clone(),
                label: Some("original".into()),
            },
            right: crate::runtime_diff::types::DiffTarget {
                run_id: format!("what_if:{}", req.run_id),
                label: req.label.clone().or(Some("what_if".into())),
            },
        },
        &original_events,
        &simulated_events,
        &original_snapshot,
        &result.snapshot,
    );

    Ok(crate::what_if::types::WhatIfComparison { result, diff })
}
