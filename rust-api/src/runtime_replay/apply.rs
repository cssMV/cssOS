use crate::event_engine::types::{EngineEvent, EventKind};

pub fn apply_event_to_runtime(
    runtime: &mut crate::film_runtime::runtime::FilmRuntime,
    ev: &EngineEvent,
) {
    match ev.kind {
        EventKind::StoryNodeEntered | EventKind::StoryBranchResolved => {
            if let Some(node_id) = ev
                .payload
                .get("node_id")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
            {
                runtime.current_story_node = Some(node_id.clone());
                runtime.immersion.state.anchor.scene_id = node_id.clone();
                if node_id.starts_with("scene_") || node_id.starts_with("ending_") {
                    runtime.presence.set_scene(node_id);
                }
            }
        }
        EventKind::SceneActivated => {
            if let Some(scene_id) = ev
                .payload
                .get("scene_id")
                .and_then(|x| x.as_str())
                .map(|s| s.to_string())
                .or_else(|| ev.meta.scene_id.clone())
            {
                runtime.presence.set_scene(scene_id.clone());
                runtime.immersion.state.anchor.scene_id = scene_id;
            }
        }
        EventKind::SceneSemanticsUpdated => {
            let scene_id = ev
                .meta
                .scene_id
                .clone()
                .or_else(|| {
                    ev.payload
                        .get("scene_id")
                        .and_then(|x| x.as_str())
                        .map(|s| s.to_string())
                })
                .unwrap_or_else(|| runtime.immersion.state.anchor.scene_id.clone());
            let semantic = parse_scene_semantic(
                ev.payload
                    .get("semantic")
                    .and_then(|x| x.as_str())
                    .unwrap_or("introduction"),
            );
            let tension = parse_scene_tension(
                ev.payload
                    .get("tension")
                    .and_then(|x| x.as_str())
                    .unwrap_or("calm"),
            );
            let mood = parse_scene_mood(
                ev.payload
                    .get("mood")
                    .and_then(|x| x.as_str())
                    .unwrap_or("warm"),
            );
            runtime.semantics.set_scene_semantics(
                crate::scene_semantics_engine::state::SceneSemanticState {
                    scene_id,
                    semantic,
                    tension,
                    mood,
                },
            );
        }
        EventKind::CameraPlanned => {
            if let Some(mode) = ev.payload.get("mode").and_then(|x| x.as_str()) {
                runtime.camera.active_mode = parse_runtime_camera_mode(mode);
                runtime.camera.strategy = "replay_camera_planned".into();
            }
        }
        EventKind::ImmersionChanged => {
            if let Some(mode) = ev.payload.get("mode").and_then(|x| x.as_str()) {
                runtime.immersion.state.mode = parse_immersion_mode(mode);
            }
        }
        EventKind::PresenceChanged => {
            if let Some(kind) = ev.payload.get("kind").and_then(|x| x.as_str()) {
                runtime.presence.state.profile.kind = parse_presence_kind(kind);
            }
        }
        _ => {}
    }
}

fn parse_scene_semantic(value: &str) -> crate::scene_semantics_engine::types::SceneSemanticKind {
    match value {
        "confession" => crate::scene_semantics_engine::types::SceneSemanticKind::Confession,
        "betrayal" => crate::scene_semantics_engine::types::SceneSemanticKind::Betrayal,
        "revelation" => crate::scene_semantics_engine::types::SceneSemanticKind::Revelation,
        "exploration" => crate::scene_semantics_engine::types::SceneSemanticKind::Exploration,
        "decision" => crate::scene_semantics_engine::types::SceneSemanticKind::Decision,
        "resolution" => crate::scene_semantics_engine::types::SceneSemanticKind::Resolution,
        "romance" => crate::scene_semantics_engine::types::SceneSemanticKind::Romance,
        "chase" => crate::scene_semantics_engine::types::SceneSemanticKind::Chase,
        "escape" => crate::scene_semantics_engine::types::SceneSemanticKind::Escape,
        _ => crate::scene_semantics_engine::types::SceneSemanticKind::Introduction,
    }
}

fn parse_scene_tension(value: &str) -> crate::scene_semantics_engine::types::SceneTensionLevel {
    match value {
        "soft" => crate::scene_semantics_engine::types::SceneTensionLevel::Soft,
        "uncertain" => crate::scene_semantics_engine::types::SceneTensionLevel::Uncertain,
        "tense" => crate::scene_semantics_engine::types::SceneTensionLevel::Tense,
        "critical" => crate::scene_semantics_engine::types::SceneTensionLevel::Critical,
        _ => crate::scene_semantics_engine::types::SceneTensionLevel::Calm,
    }
}

fn parse_scene_mood(value: &str) -> crate::scene_semantics_engine::types::SceneMood {
    match value {
        "romantic" => crate::scene_semantics_engine::types::SceneMood::Romantic,
        "mysterious" => crate::scene_semantics_engine::types::SceneMood::Mysterious,
        "fearful" => crate::scene_semantics_engine::types::SceneMood::Fearful,
        "urgent" => crate::scene_semantics_engine::types::SceneMood::Urgent,
        "tragic" => crate::scene_semantics_engine::types::SceneMood::Tragic,
        "hopeful" => crate::scene_semantics_engine::types::SceneMood::Hopeful,
        _ => crate::scene_semantics_engine::types::SceneMood::Warm,
    }
}

fn parse_runtime_camera_mode(value: &str) -> crate::film_runtime::types::RuntimeCameraMode {
    match value {
        "dialogue_two_shot" => crate::film_runtime::types::RuntimeCameraMode::DialogueTwoShot,
        "follow_character" => crate::film_runtime::types::RuntimeCameraMode::FollowCharacter,
        "wide_scene" => crate::film_runtime::types::RuntimeCameraMode::WideScene,
        "over_shoulder" => crate::film_runtime::types::RuntimeCameraMode::OverShoulder,
        _ => crate::film_runtime::types::RuntimeCameraMode::Cinematic,
    }
}

fn parse_immersion_mode(value: &str) -> crate::immersion_engine::types::ImmersionMode {
    match value {
        "cinema3d" => crate::immersion_engine::types::ImmersionMode::Cinema3d,
        "immersive360" => crate::immersion_engine::types::ImmersionMode::Immersive360,
        "spatial_observer" => crate::immersion_engine::types::ImmersionMode::SpatialObserver,
        "spatial_participant" => crate::immersion_engine::types::ImmersionMode::SpatialParticipant,
        _ => crate::immersion_engine::types::ImmersionMode::FlatScreen,
    }
}

fn parse_presence_kind(value: &str) -> crate::presence_engine::types::PresenceKind {
    match value {
        "participant" => crate::presence_engine::types::PresenceKind::Participant,
        "companion" => crate::presence_engine::types::PresenceKind::Companion,
        "witness" => crate::presence_engine::types::PresenceKind::Witness,
        "visible_observer" => crate::presence_engine::types::PresenceKind::VisibleObserver,
        "invisible_observer" => crate::presence_engine::types::PresenceKind::InvisibleObserver,
        "diegetic_character" => crate::presence_engine::types::PresenceKind::DiegeticCharacter,
        _ => crate::presence_engine::types::PresenceKind::None,
    }
}
