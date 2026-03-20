pub fn run_continuity_check(
    req: crate::continuity_engine::types::ContinuityRequest,
) -> anyhow::Result<crate::continuity_engine::types::ContinuityReport> {
    let st = crate::run_store::load_run_state(&req.run_id)?;
    let mut runtime = crate::runtime_replay::replayer::build_replay_runtime(&st)?;
    let events = crate::runtime_replay::storage::load_runtime_events(&req.run_id)?;
    for ev in &events {
        crate::runtime_replay::apply::apply_event_to_runtime(&mut runtime, ev);
        let _ = runtime.tick(crate::film_runtime::types::RuntimeTickReason::EventDriven);
    }
    let snapshot = runtime.snapshot();
    let mut issues = Vec::new();
    issues.extend(crate::continuity_engine::checks::check_time_continuity(
        &events,
    ));
    issues.extend(crate::continuity_engine::checks::check_location_continuity(
        &snapshot, &st,
    ));
    issues.extend(crate::continuity_engine::checks::check_character_position_continuity(&events));
    issues.extend(crate::continuity_engine::checks::check_object_state_continuity(&events));
    issues.extend(crate::continuity_engine::checks::check_camera_continuity(
        &runtime.semantics,
        &snapshot,
    ));
    let passed = !issues.iter().any(|x| {
        matches!(
            x.severity,
            crate::continuity_engine::types::ContinuitySeverity::Error
        )
    });
    Ok(crate::continuity_engine::types::ContinuityReport { passed, issues })
}
