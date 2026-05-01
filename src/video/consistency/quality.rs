use crate::video::contracts::{QualityProfile, SceneInput, StyleProfile};

pub fn resolve_scene_quality(scene: &SceneInput, style: &StyleProfile) -> QualityProfile {
    let global = style.quality_profile.as_ref();
    let scene_quality = scene.quality.as_ref();
    let emotional_beat = scene
        .director
        .as_ref()
        .and_then(|director| director.emotional_beat.as_deref())
        .unwrap_or("");
    let shot_type = scene
        .director
        .as_ref()
        .and_then(|director| director.shot_type.as_deref())
        .unwrap_or("");
    let camera_move = scene
        .director
        .as_ref()
        .and_then(|director| director.camera_move.as_deref())
        .unwrap_or("");

    let motion_intensity = scene_quality
        .and_then(|quality| quality.motion_intensity)
        .or_else(|| global.and_then(|quality| quality.motion_intensity))
        .unwrap_or_else(|| match camera_move {
            "orbit" => 0.92,
            "crane" => 0.82,
            "glide" => 0.68,
            "push" => 0.74,
            _ => 0.55,
        });
    let cut_density = scene_quality
        .and_then(|quality| quality.cut_density)
        .or_else(|| global.and_then(|quality| quality.cut_density))
        .unwrap_or_else(|| match emotional_beat {
            "peak" => 0.84,
            "release" => 0.72,
            "lift" => 0.62,
            _ => 0.45,
        });
    let continuity_priority = scene_quality
        .and_then(|quality| quality.continuity_priority)
        .or_else(|| global.and_then(|quality| quality.continuity_priority))
        .unwrap_or(if scene.entities.characters.is_empty() {
            0.68
        } else {
            0.82
        });
    let performance_focus = scene_quality
        .and_then(|quality| quality.performance_focus)
        .or_else(|| global.and_then(|quality| quality.performance_focus))
        .unwrap_or(
            if matches!(shot_type, "close" | "close_medium" | "detail") {
                0.86
            } else {
                0.64
            },
        );
    let chorus_impact = scene_quality
        .and_then(|quality| quality.chorus_impact)
        .or_else(|| global.and_then(|quality| quality.chorus_impact))
        .unwrap_or(if scene.section_type.to_lowercase().contains("chorus") {
            0.9
        } else if scene.section_type.to_lowercase().contains("bridge") {
            0.75
        } else {
            0.58
        });
    let avoid_static_frames = scene_quality
        .and_then(|quality| quality.avoid_static_frames)
        .or_else(|| global.and_then(|quality| quality.avoid_static_frames))
        .unwrap_or(true);

    QualityProfile {
        motion_intensity: Some(motion_intensity),
        cut_density: Some(cut_density),
        continuity_priority: Some(continuity_priority),
        performance_focus: Some(performance_focus),
        chorus_impact: Some(chorus_impact),
        avoid_static_frames: Some(avoid_static_frames),
    }
}
