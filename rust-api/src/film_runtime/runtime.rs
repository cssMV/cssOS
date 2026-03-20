use crate::event_engine::runtime::EventEngine;
use crate::event_engine::types::{EngineEvent, EventDomain, EventId, EventKind, EventMeta};
use crate::film_runtime::snapshot::FilmRuntimeSnapshot;
use crate::film_runtime::types::{
    RuntimeCameraMode, RuntimeConfig, RuntimeStatus, RuntimeTickReason,
};
use crate::film_runtime::updates::RuntimeUpdate;
use crate::immersion_engine::runtime::ImmersionEngine;
use crate::physics_engine::types::Vec3;
use crate::presence_engine::runtime::PresenceEngine;
use crate::run_state::RunState;
use crate::scene_semantics_engine::planner::SceneSemanticPlanningInput;
use crate::scene_semantics_engine::runtime::SceneSemanticsEngine;
use crate::scheduler::Scheduler;
use serde::{Deserialize, Serialize};
use std::sync::atomic::{AtomicU64, Ordering};

static EVENT_SEQ: AtomicU64 = AtomicU64::new(1);

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct RuntimeCameraState {
    pub active_mode: RuntimeCameraMode,
    pub strategy: String,
    pub fov_deg: f32,
}

impl Default for RuntimeCameraState {
    fn default() -> Self {
        Self {
            active_mode: RuntimeCameraMode::Cinematic,
            strategy: "bootstrap".into(),
            fov_deg: 60.0,
        }
    }
}

pub struct FilmRuntime {
    pub config: RuntimeConfig,
    pub status: RuntimeStatus,
    pub scheduler: Scheduler,
    pub current_story_node: Option<String>,
    pub scene_tags: Vec<String>,
    pub viewer_position: Vec3,
    pub camera: RuntimeCameraState,
    pub immersion: ImmersionEngine,
    pub presence: PresenceEngine,
    pub semantics: SceneSemanticsEngine,
    pub events: EventEngine,
}

impl FilmRuntime {
    pub fn new(
        config: RuntimeConfig,
        current_story_node: Option<String>,
        scene_tags: Vec<String>,
        viewer_position: Vec3,
        camera: RuntimeCameraState,
        immersion: ImmersionEngine,
        presence: PresenceEngine,
        semantics: SceneSemanticsEngine,
        events: EventEngine,
    ) -> Self {
        let scheduler = Scheduler::from_immersion(immersion.snapshot_at(viewer_position));
        Self {
            config,
            status: RuntimeStatus::Initializing,
            scheduler,
            current_story_node,
            scene_tags,
            viewer_position,
            camera,
            immersion,
            presence,
            semantics,
            events,
        }
    }

    pub fn from_run_state(run_state: &RunState) -> Self {
        let viewer_position = run_state
            .viewer_position
            .unwrap_or_else(|| Vec3::new(0.0, 0.0, 0.0));
        let immersion = ImmersionEngine::new(
            run_state.immersion.clone(),
            run_state.immersion_zones.clone(),
        );
        let presence = PresenceEngine::new(run_state.presence.clone());
        let semantics = SceneSemanticsEngine::new(run_state.scene_semantics.clone());
        let mut events = EventEngine::new();
        for ev in &run_state.event_engine.history {
            events.publish(ev.clone());
        }
        let _ = events.drain_once();

        Self::new(
            RuntimeConfig {
                mode: runtime_mode_from_immersion(&run_state.immersion),
                preserve_story_focus: crate::immersion_engine::policy::preserve_director_focus(
                    &run_state.immersion,
                ),
                allow_spatial_interaction: run_state.immersion.can_move_freely,
                ..RuntimeConfig::default()
            },
            Some(run_state.immersion.anchor.scene_id.clone()),
            collect_runtime_scene_tags(run_state),
            viewer_position,
            RuntimeCameraState::default(),
            immersion,
            presence,
            semantics,
            events,
        )
    }

    pub fn write_back(&self, run_state: &mut RunState) {
        run_state.immersion = self.immersion.state.clone();
        run_state.immersion_zones = self.immersion.zones.clone();
        run_state.presence = self.presence.state.clone();
        run_state.scene_semantics = self.semantics.state.clone();
        run_state.viewer_position = Some(self.viewer_position);
        run_state.event_engine = self.events.snapshot();
    }

    pub fn dispatch_event(&mut self, ev: EngineEvent) -> RuntimeUpdate {
        let mut out = RuntimeUpdate::default();
        self.events.publish(ev.clone());
        let drained = self.events.drain_once();
        out.logs.push(format!("drained_events={}", drained.len()));
        out.emitted_events.extend(drained.iter().cloned());

        for drained_ev in drained {
            match drained_ev.kind {
                EventKind::StoryNodeEntered => {
                    self.current_story_node = story_node_from_event(&drained_ev);
                    if let Some(scene_id) = self.current_story_node.clone() {
                        self.immersion.state.anchor.scene_id = scene_id.clone();
                        self.presence.set_scene(scene_id);
                    }
                }
                EventKind::SceneActivated => {
                    if let Some(scene_id) = drained_ev
                        .meta
                        .scene_id
                        .clone()
                        .or_else(|| story_node_from_event(&drained_ev))
                    {
                        self.presence.set_scene(scene_id.clone());
                        self.immersion.state.anchor.scene_id = scene_id;
                    }
                }
                EventKind::SceneSemanticsUpdated => {
                    if let Some(scene_id) = drained_ev.meta.scene_id.clone() {
                        self.presence.set_scene(scene_id);
                    }
                }
                EventKind::ImmersionChanged => {
                    if let Some(mode) = drained_ev
                        .payload
                        .get("mode")
                        .and_then(|v| serde_json::from_value(v.clone()).ok())
                    {
                        self.immersion.set_mode(mode);
                    }
                }
                _ => {}
            }
        }

        out
    }

    pub fn apply_updates(&mut self) -> RuntimeUpdate {
        let mut out = RuntimeUpdate::default();

        self.presence.sync_from_immersion(&self.immersion.state);

        let current_scene = self
            .current_story_node
            .clone()
            .or_else(|| Some(self.immersion.state.anchor.scene_id.clone()))
            .unwrap_or_else(|| "unknown".into());
        self.presence.set_scene(current_scene.clone());
        self.immersion.state.anchor.scene_id = current_scene.clone();

        self.semantics.plan_and_set(SceneSemanticPlanningInput {
            scene_id: current_scene.clone(),
            tags: self.scene_tags.clone(),
            dominant_relationship: None,
            dominant_emotion: None,
        });

        if let Some(scene) = self.semantics.state.get(&current_scene) {
            let camera_hint = crate::scene_semantics_engine::rules::preferred_camera_mode(
                &scene.semantic,
                &scene.tension,
            );
            self.camera.active_mode = runtime_camera_mode_from_hint(camera_hint);
            self.camera.strategy = format!("scene_semantics::{:?}", scene.semantic).to_lowercase();
            self.immersion.state.constraint_level =
                crate::scene_semantics_engine::rules::preferred_immersion_constraint(
                    &scene.semantic,
                    &scene.tension,
                );
        }

        let immersion_snapshot = self.immersion.snapshot_at(self.viewer_position);
        self.scheduler = Scheduler::from_immersion(immersion_snapshot.clone());
        self.config.preserve_story_focus = immersion_snapshot.preserve_director_focus;
        self.config.allow_spatial_interaction = immersion_snapshot.allow_free_movement;

        out.logs.push("applied_cross_engine_updates".into());
        out
    }

    pub fn tick(&mut self, reason: RuntimeTickReason) -> RuntimeUpdate {
        let mut out = RuntimeUpdate::default();

        if self.status == RuntimeStatus::Initializing {
            self.status = RuntimeStatus::Running;
            out.logs.push("runtime_initialized".into());
        }

        out.logs.push(format!("tick_reason={reason:?}"));
        out.merge(self.apply_updates());
        out
    }

    pub fn handle_raw_interaction(&mut self, raw: serde_json::Value) -> RuntimeUpdate {
        let ev = EngineEvent {
            id: EventId(next_event_id()),
            domain: EventDomain::Interaction,
            kind: EventKind::InteractionReceived,
            meta: EventMeta {
                ts: crate::timeutil::now_rfc3339(),
                scene_id: self.presence.state.current_scene.clone(),
                branch_id: None,
                actor_id: None,
                target_id: raw
                    .get("target_id")
                    .and_then(|v| v.as_str())
                    .map(|s| s.to_string()),
            },
            payload: raw,
        };

        let mut out = self.dispatch_event(ev);
        out.merge(self.tick(RuntimeTickReason::UserInteraction));
        out
    }

    pub fn snapshot(&self) -> FilmRuntimeSnapshot {
        FilmRuntimeSnapshot {
            status: self.status.clone(),
            current_story_node: self.current_story_node.clone(),
            current_scene: self.presence.state.current_scene.clone(),
            camera_mode: Some(format!("{:?}", self.camera.active_mode).to_lowercase()),
            immersion_mode: Some(format!("{:?}", self.immersion.state.mode).to_lowercase()),
            presence_kind: Some(format!("{:?}", self.presence.state.profile.kind).to_lowercase()),
            event_history_len: self.events.bus.history.len(),
        }
    }
}

fn collect_runtime_scene_tags(run_state: &RunState) -> Vec<String> {
    let mut tags = Vec::new();

    if let Some(items) = run_state
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
    if let Some(items) = run_state
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
    if let Some(mood) = run_state
        .commands
        .get("creative")
        .and_then(|v| v.get("mood"))
        .and_then(|v| v.as_str())
    {
        tags.push(mood.to_lowercase());
    }
    if tags.is_empty() {
        tags.push(run_state.cssl.to_lowercase());
    }

    tags
}

fn runtime_mode_from_immersion(
    immersion: &crate::immersion_engine::state::ImmersionState,
) -> crate::film_runtime::types::RuntimeMode {
    match immersion.mode {
        crate::immersion_engine::types::ImmersionMode::FlatScreen
        | crate::immersion_engine::types::ImmersionMode::Cinema3d => {
            crate::film_runtime::types::RuntimeMode::PassivePlayback
        }
        crate::immersion_engine::types::ImmersionMode::Immersive360
        | crate::immersion_engine::types::ImmersionMode::SpatialObserver
        | crate::immersion_engine::types::ImmersionMode::SpatialParticipant => {
            crate::film_runtime::types::RuntimeMode::SpatialFilm
        }
    }
}

fn runtime_camera_mode_from_hint(
    hint: crate::scene_semantics_engine::types::SceneCameraHint,
) -> RuntimeCameraMode {
    match hint {
        crate::scene_semantics_engine::types::SceneCameraHint::Cinematic => {
            RuntimeCameraMode::Cinematic
        }
        crate::scene_semantics_engine::types::SceneCameraHint::DialogueTwoShot => {
            RuntimeCameraMode::DialogueTwoShot
        }
        crate::scene_semantics_engine::types::SceneCameraHint::OverShoulder => {
            RuntimeCameraMode::OverShoulder
        }
        crate::scene_semantics_engine::types::SceneCameraHint::FollowCharacter => {
            RuntimeCameraMode::FollowCharacter
        }
        crate::scene_semantics_engine::types::SceneCameraHint::WideScene => {
            RuntimeCameraMode::WideScene
        }
    }
}

fn story_node_from_event(ev: &EngineEvent) -> Option<String> {
    ev.payload
        .get("node_id")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .or_else(|| ev.meta.scene_id.clone())
}

fn next_event_id() -> String {
    format!("ev_{}", EVENT_SEQ.fetch_add(1, Ordering::Relaxed))
}

#[cfg(test)]
mod tests {
    use super::FilmRuntime;
    use crate::event_engine::runtime::EventEngine;
    use crate::film_runtime::types::{RuntimeConfig, RuntimeStatus, RuntimeTickReason};
    use crate::immersion_engine::runtime::ImmersionEngine;
    use crate::immersion_engine::state::ImmersionState;
    use crate::immersion_engine::types::{ImmersionMode, PresenceRole};
    use crate::presence_engine::runtime::PresenceEngine;
    use crate::presence_engine::types::PresenceKind;
    use crate::scene_semantics_engine::runtime::SceneSemanticsEngine;

    #[test]
    fn v143_tick_syncs_scene_semantics_camera_and_presence() {
        let immersion = ImmersionState {
            mode: ImmersionMode::SpatialParticipant,
            presence_role: PresenceRole::Participant,
            can_move_freely: true,
            can_affect_story: true,
            anchor: crate::immersion_engine::types::PresenceAnchor {
                scene_id: "scene_confession".into(),
                location_id: None,
                near_character_id: None,
            },
            ..ImmersionState::default()
        };
        let mut runtime = FilmRuntime::new(
            RuntimeConfig::default(),
            Some("scene_confession".into()),
            vec!["confession".into(), "love".into()],
            crate::physics_engine::types::Vec3::new(0.0, 0.0, 0.0),
            Default::default(),
            ImmersionEngine::new(immersion, vec![]),
            PresenceEngine::new(Default::default()),
            SceneSemanticsEngine::new(Default::default()),
            EventEngine::new(),
        );

        let update = runtime.tick(RuntimeTickReason::Frame);
        let snapshot = runtime.snapshot();

        assert_eq!(runtime.status, RuntimeStatus::Running);
        assert!(update.logs.iter().any(|log| log == "runtime_initialized"));
        assert_eq!(snapshot.current_scene.as_deref(), Some("scene_confession"));
        assert_eq!(
            snapshot.current_story_node.as_deref(),
            Some("scene_confession")
        );
        assert_eq!(snapshot.camera_mode.as_deref(), Some("dialoguetwoshot"));
        assert_eq!(
            snapshot.immersion_mode.as_deref(),
            Some("spatialparticipant")
        );
        assert_eq!(
            runtime.presence.state.profile.kind,
            PresenceKind::Participant
        );
        assert_eq!(
            runtime.immersion.state.constraint_level,
            crate::immersion_engine::types::ImmersionConstraintLevel::Guided
        );
    }

    #[test]
    fn v143_handle_raw_interaction_emits_runtime_event_history() {
        let mut runtime = FilmRuntime::new(
            RuntimeConfig::default(),
            Some("scene_intro".into()),
            vec!["explore".into()],
            crate::physics_engine::types::Vec3::new(0.0, 0.0, 0.0),
            Default::default(),
            ImmersionEngine::new(Default::default(), vec![]),
            PresenceEngine::new(Default::default()),
            SceneSemanticsEngine::new(Default::default()),
            EventEngine::new(),
        );

        let out = runtime.handle_raw_interaction(serde_json::json!({
            "type": "voice_text",
            "text": "please say i love you"
        }));

        assert_eq!(runtime.events.bus.history.len(), 1);
        assert_eq!(runtime.snapshot().event_history_len, 1);
        assert!(out
            .logs
            .iter()
            .any(|log| log.starts_with("drained_events=")));
    }
}
