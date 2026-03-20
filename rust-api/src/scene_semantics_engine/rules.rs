use crate::immersion_engine::types::ImmersionConstraintLevel;
use crate::scene_semantics_engine::types::{
    SceneCameraHint, SceneMood, SceneSemanticKind, SceneTensionLevel,
};

pub fn preferred_camera_mode(
    semantic: &SceneSemanticKind,
    tension: &SceneTensionLevel,
) -> SceneCameraHint {
    match (semantic, tension) {
        (SceneSemanticKind::Confession, _) => SceneCameraHint::DialogueTwoShot,
        (SceneSemanticKind::Romance, _) => SceneCameraHint::OverShoulder,
        (SceneSemanticKind::Revelation, SceneTensionLevel::Critical) => SceneCameraHint::Cinematic,
        (SceneSemanticKind::Chase, _) | (SceneSemanticKind::Escape, _) => {
            SceneCameraHint::FollowCharacter
        }
        (SceneSemanticKind::Exploration, _) => SceneCameraHint::WideScene,
        _ => SceneCameraHint::Cinematic,
    }
}

pub fn dialogue_tone_hint(mood: &SceneMood, tension: &SceneTensionLevel) -> &'static str {
    match (mood, tension) {
        (SceneMood::Romantic, _) => "gentle",
        (SceneMood::Fearful, _) => "careful",
        (SceneMood::Urgent, _) => "fast",
        (SceneMood::Tragic, _) => "heavy",
        (SceneMood::Mysterious, _) => "low",
        (_, SceneTensionLevel::Critical) => "intense",
        _ => "neutral",
    }
}

pub fn preferred_immersion_constraint(
    semantic: &SceneSemanticKind,
    tension: &SceneTensionLevel,
) -> ImmersionConstraintLevel {
    match (semantic, tension) {
        (SceneSemanticKind::Decision, _) => ImmersionConstraintLevel::Guided,
        (SceneSemanticKind::Revelation, SceneTensionLevel::Critical) => {
            ImmersionConstraintLevel::Strict
        }
        (SceneSemanticKind::Confession, _) => ImmersionConstraintLevel::Guided,
        (SceneSemanticKind::Exploration, _) => ImmersionConstraintLevel::Open,
        (SceneSemanticKind::Escape, _) => ImmersionConstraintLevel::Guided,
        _ => ImmersionConstraintLevel::Guided,
    }
}
