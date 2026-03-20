use crate::film_runtime::runtime::{FilmRuntime, RuntimeCameraState};
use crate::film_runtime::types::{RuntimeConfig, RuntimeMode, RuntimeTickReason};
use crate::runtime_replay::types::{ReplayMode, ReplayRequest, ReplayResult};

pub fn build_replay_runtime(st: &crate::run_state::RunState) -> anyhow::Result<FilmRuntime> {
    let viewer_position = st
        .viewer_position
        .unwrap_or_else(|| crate::physics_engine::types::Vec3::new(0.0, 0.0, 0.0));
    let immersion_state = st
        .commands
        .get("immersion")
        .and_then(|v| v.get("state").cloned().or_else(|| Some(v.clone())))
        .and_then(|v| serde_json::from_value(v).ok())
        .unwrap_or_else(crate::immersion_engine::state::ImmersionState::default);

    Ok(FilmRuntime::new(
        RuntimeConfig {
            mode: replay_runtime_mode(
                st.commands
                    .get("film_runtime")
                    .and_then(|v| v.get("mode"))
                    .and_then(|v| v.as_str()),
            ),
            ..RuntimeConfig::default()
        },
        None,
        collect_tags(st),
        viewer_position,
        RuntimeCameraState::default(),
        crate::immersion_engine::runtime::ImmersionEngine::new(
            immersion_state,
            st.immersion_zones.clone(),
        ),
        crate::presence_engine::runtime::PresenceEngine::new(Default::default()),
        crate::scene_semantics_engine::runtime::SceneSemanticsEngine::new(Default::default()),
        crate::event_engine::runtime::EventEngine::new(),
    ))
}

pub fn replay_run(req: ReplayRequest) -> anyhow::Result<ReplayResult> {
    let st = crate::run_store::load_run_state(&req.run_id)?;
    let events = crate::runtime_replay::storage::load_runtime_events(&req.run_id)?;
    let total_events = events.len();
    let limit = match req.mode {
        ReplayMode::Full => total_events,
        ReplayMode::UntilCursor => req
            .cursor
            .as_ref()
            .map(|c| c.event_index.saturating_add(1))
            .unwrap_or(total_events)
            .min(total_events),
    };

    let mut runtime = build_replay_runtime(&st)?;
    for ev in events.iter().take(limit) {
        crate::runtime_replay::apply::apply_event_to_runtime(&mut runtime, ev);
        let _ = runtime.tick(RuntimeTickReason::EventDriven);
    }

    Ok(ReplayResult {
        run_id: req.run_id,
        applied_events: limit,
        total_events,
        replayable: true,
        snapshot: runtime.snapshot(),
    })
}

fn replay_runtime_mode(mode: Option<&str>) -> RuntimeMode {
    match mode.unwrap_or("interactive_film") {
        "passive_playback" => RuntimeMode::PassivePlayback,
        "spatial_film" => RuntimeMode::SpatialFilm,
        _ => RuntimeMode::InteractiveFilm,
    }
}

fn collect_tags(st: &crate::run_state::RunState) -> Vec<String> {
    let mut tags = Vec::new();
    if let Some(items) = st
        .commands
        .get("scene_semantics")
        .and_then(|v| v.get("tags"))
        .and_then(|v| v.as_array())
    {
        tags.extend(
            items
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase())),
        );
    }
    if let Some(items) = st
        .commands
        .get("creative")
        .and_then(|v| v.get("tags"))
        .and_then(|v| v.as_array())
    {
        tags.extend(
            items
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_lowercase())),
        );
    }
    if tags.is_empty() {
        tags.push(st.cssl.to_lowercase());
    }
    tags
}
