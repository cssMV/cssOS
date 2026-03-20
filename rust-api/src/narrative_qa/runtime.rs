pub fn run_narrative_qa(
    req: crate::narrative_qa::types::NarrativeQaRequest,
) -> anyhow::Result<crate::narrative_qa::types::NarrativeQaReport> {
    let st = crate::run_store::load_run_state(&req.run_id)?;
    let mut runtime = crate::runtime_replay::replayer::build_replay_runtime(&st)?;
    let events = crate::runtime_replay::storage::load_runtime_events(&req.run_id)?;
    for ev in &events {
        crate::runtime_replay::apply::apply_event_to_runtime(&mut runtime, ev);
        let _ = runtime.tick(crate::film_runtime::types::RuntimeTickReason::EventDriven);
    }
    let snapshot = runtime.snapshot();
    let mut issues = Vec::new();
    issues
        .extend(crate::narrative_qa::checks::check_relationship_contradictions(&events, &snapshot));
    issues.extend(crate::narrative_qa::checks::check_emotion_jump(&events));
    issues.extend(crate::narrative_qa::checks::check_scene_semantic_match(
        &runtime.semantics,
        &snapshot,
    ));
    issues.extend(crate::narrative_qa::checks::check_ending_setup(
        &events, &snapshot,
    ));
    issues.extend(
        crate::narrative_qa::checks::check_character_motivation_break(&st.commands, &snapshot),
    );
    let passed = crate::narrative_qa::checks::passed_from_issues(&issues);
    Ok(crate::narrative_qa::types::NarrativeQaReport { passed, issues })
}
