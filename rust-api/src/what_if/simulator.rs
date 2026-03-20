pub fn build_simulation_runtime(
    st: &crate::run_state::RunState,
) -> anyhow::Result<crate::film_runtime::runtime::FilmRuntime> {
    crate::runtime_replay::replayer::build_replay_runtime(st)
}

pub fn replay_events_into_runtime(
    runtime: &mut crate::film_runtime::runtime::FilmRuntime,
    events: &[crate::event_engine::types::EngineEvent],
) {
    for ev in events {
        crate::runtime_replay::apply::apply_event_to_runtime(runtime, ev);
        let _ = runtime.tick(crate::film_runtime::types::RuntimeTickReason::EventDriven);
    }
}

pub fn simulate_what_if(
    req: crate::what_if::types::WhatIfRequest,
) -> anyhow::Result<crate::what_if::types::WhatIfResult> {
    let st = crate::run_store::load_run_state(&req.run_id)?;
    let original_events = crate::runtime_replay::storage::load_runtime_events(&req.run_id)?;
    let simulated_events =
        crate::what_if::injection::apply_injection(&original_events, &req.injection);
    let mut runtime = build_simulation_runtime(&st)?;
    replay_events_into_runtime(&mut runtime, &simulated_events);

    Ok(crate::what_if::types::WhatIfResult {
        source_run_id: req.run_id,
        label: req.label,
        cursor_event_index: req.injection.cursor.event_index,
        original_total_events: original_events.len(),
        simulated_total_events: simulated_events.len(),
        snapshot: runtime.snapshot(),
    })
}
