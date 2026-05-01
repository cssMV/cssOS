use crate::video::consistency::resolve_scene_quality;
use crate::video::contracts::{
    CharacterProfile, ContinuityScore, NormalizedStyleProfile, SceneInput, ShotPlan, StyleProfile,
};

pub fn score_continuity(
    scenes: &[SceneInput],
    profiles: &[CharacterProfile],
    style: &NormalizedStyleProfile,
    style_input: &StyleProfile,
    shots: &[ShotPlan],
) -> Vec<ContinuityScore> {
    scenes
        .iter()
        .map(|scene| {
            let quality = resolve_scene_quality(scene, style_input);
            let profile_hits = profiles
                .iter()
                .filter(|profile| profile.scene_ids.contains(&scene.id))
                .count() as f32;
            let continuity_priority = quality.continuity_priority.unwrap_or(0.7);
            let character_score = if scene.entities.characters.is_empty() {
                0.72 + continuity_priority * 0.14
            } else {
                (0.7 + continuity_priority * 0.1 + (profile_hits * 0.08)).min(1.0)
            };
            let shot = shots.iter().find(|item| item.scene_id == scene.id);
            let shot_score = if let Some(shot) = shot {
                let camera_alignment = if style
                    .camera_language
                    .to_lowercase()
                    .contains(&shot.movement.to_lowercase())
                {
                    0.9
                } else {
                    0.82
                };
                let motion_bonus = (shot.motion_intensity * 0.08).min(0.08);
                let static_guard_bonus = if quality.avoid_static_frames.unwrap_or(false) {
                    0.02
                } else {
                    0.0
                };
                (camera_alignment + motion_bonus + static_guard_bonus).min(1.0)
            } else {
                0.75
            };
            let style_score = if style.visual_tone.trim().is_empty() {
                0.8
            } else {
                let chorus_impact = quality.chorus_impact.unwrap_or(0.65);
                let performance_focus = quality.performance_focus.unwrap_or(0.6);
                (0.82 + (chorus_impact * 0.06) + (performance_focus * 0.06)).min(0.97)
            };
            let overall_score =
                ((character_score + shot_score + style_score) / 3.0 * 100.0).round() / 100.0;
            let mut notes = Vec::new();
            if !scene.entities.location.trim().is_empty() {
                notes.push(format!("location anchor: {}", scene.entities.location));
            }
            if !scene.entities.characters.is_empty() {
                notes.push(format!(
                    "character continuity on {}",
                    scene.entities.characters.join(", ")
                ));
            }
            if let Some(director) = scene.director.as_ref() {
                if let Some(beat) = director.emotional_beat.as_deref() {
                    notes.push(format!("director beat: {beat}"));
                }
            }
            notes.push(format!("camera language kept {}", style.camera_language));
            ContinuityScore {
                scene_id: scene.id,
                character_score,
                style_score,
                shot_score,
                overall_score,
                notes,
            }
        })
        .collect()
}
