use crate::video::consistency::{ArcTimelineBeat, resolve_scene_quality};
use crate::video::contracts::{NormalizedStyleProfile, SceneInput, ShotPlan, StyleProfile};

pub fn plan_shots(
    scenes: &[SceneInput],
    timeline: &[ArcTimelineBeat],
    style: &NormalizedStyleProfile,
    style_input: &StyleProfile,
) -> Vec<ShotPlan> {
    let opening_scene_id = scenes.first().map(|scene| scene.id);
    let opening_verse_scene_id = scenes
        .iter()
        .find(|scene| {
            timeline
                .iter()
                .find(|beat| beat.scene_id == scene.id)
                .map(|beat| beat.section_role == "verse")
                .unwrap_or(false)
        })
        .map(|scene| scene.id)
        .or(opening_scene_id);
    scenes
        .iter()
        .map(|scene| {
            let director = scene.director.as_ref();
            let quality = resolve_scene_quality(scene, style_input);
            let arc_beat = timeline.iter().find(|beat| beat.scene_id == scene.id);
            let arc_role = arc_beat
                .map(|beat| beat.section_role.as_str())
                .unwrap_or("verse");
            let is_primary_explosion = arc_beat
                .map(|beat| beat.is_primary_explosion)
                .unwrap_or(false);
            let is_secondary_explosion = arc_beat
                .map(|beat| beat.is_secondary_explosion)
                .unwrap_or(false);
            let is_aftershock = arc_beat.map(|beat| beat.is_aftershock).unwrap_or(false);
            let is_resolution = arc_beat.map(|beat| beat.is_resolution).unwrap_or(false);
            let character_count = scene.entities.characters.len();
            let shot_distance_preference =
                if character_count >= 3 && (is_primary_explosion || arc_role == "chorus") {
                    "wide_ensemble"
                } else if character_count >= 3 && is_aftershock {
                    "medium_duo"
                } else if character_count >= 3 {
                    "wide_ensemble"
                } else if character_count == 2 && (is_primary_explosion || is_secondary_explosion) {
                    "medium_duo"
                } else if character_count == 2 {
                    "medium_duo"
                } else if is_primary_explosion || arc_role == "chorus" {
                    "hero_medium"
                } else if arc_role == "bridge" {
                    "close_pressure"
                } else if is_resolution || arc_role == "outro" {
                    "wide_release"
                } else {
                    "hero_close"
                };
            let shot_size = director
                .and_then(|item| item.shot_type.as_deref())
                .unwrap_or_else(|| match shot_distance_preference {
                    "wide_ensemble" => "ensemble-wide",
                    "wide_release" => "aerial",
                    "medium_duo" => "two-shot",
                    "hero_medium" => "medium",
                    "close_pressure" => "tight-close",
                    "hero_close" | "close_intro" => "close-medium",
                    _ => match arc_role {
                        "chorus" => "wide",
                        "bridge" => "medium",
                        "outro" => "aerial",
                        "intro" => "establishing",
                        _ => "close-medium",
                    },
                });
            let ensemble_mode = if character_count >= 3 {
                "group"
            } else if character_count == 2 {
                "duo"
            } else if character_count == 1 {
                "solo"
            } else {
                "environment"
            };
            let camera_language = director
                .and_then(|item| item.camera_language.as_deref())
                .unwrap_or(&style.camera_language);
            let movement = director
                .and_then(|item| item.camera_move.as_deref())
                .unwrap_or_else(|| {
                    if is_primary_explosion && shot_size == "tight-close" {
                        "push-pull"
                    } else if is_primary_explosion {
                        "orbit"
                    } else if is_aftershock && shot_size == "ensemble-wide" {
                        "glide"
                    } else if arc_role == "chorus" {
                        "orbit"
                    } else if arc_role == "bridge" {
                        "push"
                    } else if arc_role == "outro" {
                        "crane"
                    } else if camera_language.to_lowercase().contains("gliding") {
                        "glide"
                    } else if camera_language.to_lowercase().contains("handheld") {
                        "handheld"
                    } else {
                        "push-pull"
                    }
                });
            let pacing =
                if let Some(beat) = director.and_then(|item| item.emotional_beat.as_deref()) {
                    match beat {
                        "peak" => "surging",
                        "release" => "driving",
                        "resolve" => "measured",
                        "setup" => "patient",
                        _ => "steady",
                    }
                } else if scene.duration_secs >= 14.0 {
                    "measured"
                } else if scene.duration_secs >= 8.0 {
                    "steady"
                } else {
                    "urgent"
                };
            let lens_profile = match shot_size {
                "ensemble-wide" => "24mm",
                "wide" => "28mm",
                "establishing" => "24mm",
                "aerial" => "35mm",
                "two-shot" => "40mm",
                "medium" => "45mm",
                "tight-close" => "65mm",
                _ => "50mm",
            };
            let motion_intensity = quality.motion_intensity.unwrap_or_else(|| {
                if is_primary_explosion {
                    0.96
                } else if movement == "orbit" || pacing == "surging" {
                    0.9
                } else if movement == "glide" {
                    0.65
                } else {
                    0.5
                }
            });
            let director_intent = director
                .and_then(|item| item.emotional_beat.as_deref())
                .map(|beat| {
                    format!(
                        "{arc_role} arc · {} · {beat} beat with {movement} movement",
                        arc_beat
                            .map(|item| item.energy_phase.as_str())
                            .unwrap_or("steady_flow")
                    )
                })
                .unwrap_or_else(|| {
                    format!(
                        "{arc_role} arc · {} · {pacing} pacing with {movement} movement",
                        arc_beat
                            .map(|item| item.energy_phase.as_str())
                            .unwrap_or("steady_flow")
                    )
                });
            let transition_style =
                if let Some(beat) = director.and_then(|item| item.emotional_beat.as_deref()) {
                    match beat {
                        "peak" => "flash-cut",
                        "release" => "lift-fade",
                        "resolve" => "long-fade",
                        _ => "match-cut",
                    }
                } else if is_primary_explosion && shot_size == "tight-close" {
                    "flash-cut"
                } else if is_resolution && shot_distance_preference == "wide_release" {
                    "long-fade"
                } else if is_primary_explosion || arc_role == "chorus" {
                    "flash-cut"
                } else if shot_distance_preference == "wide_ensemble" {
                    "smash-dissolve"
                } else if shot_distance_preference == "medium_duo" {
                    "match-cut"
                } else if arc_role == "bridge" {
                    "smash-dissolve"
                } else if arc_role == "outro" {
                    "long-fade"
                } else {
                    "match-cut"
                };
            let transition_secs: f32 = quality
                .cut_density
                .map(|density| {
                    if is_primary_explosion && shot_size == "tight-close" {
                        0.12
                    } else if is_primary_explosion {
                        0.14
                    } else if is_aftershock {
                        0.24
                    } else if is_resolution {
                        0.46
                    } else if density >= 0.8 {
                        0.18
                    } else if density >= 0.65 {
                        0.28
                    } else {
                        0.4
                    }
                })
                .unwrap_or(0.3);
            let transition_secs = if shot_distance_preference == "wide_ensemble" {
                transition_secs.max(0.26_f32)
            } else if shot_distance_preference == "hero_close" || shot_size == "tight-close" {
                transition_secs.min(0.2_f32)
            } else if arc_role == "outro" {
                transition_secs.max(0.48_f32)
            } else if arc_role == "chorus" {
                transition_secs.min(0.22_f32)
            } else {
                transition_secs
            };
            let motif_target_scene_id = if is_resolution || arc_role == "outro" {
                opening_verse_scene_id.filter(|scene_id| *scene_id != scene.id)
            } else if is_aftershock {
                opening_scene_id.filter(|scene_id| *scene_id != scene.id)
            } else {
                None
            };
            let motif_callback_style = if is_resolution || arc_role == "outro" {
                "direct-closing-response"
            } else if is_aftershock {
                "chapter-echo"
            } else if is_primary_explosion || is_secondary_explosion {
                "impact-hook"
            } else {
                "forward-drive"
            };
            let relationship_arc = if character_count >= 3 {
                if is_primary_explosion {
                    "scatter_to_center"
                } else if is_aftershock || is_resolution || arc_role == "outro" {
                    "center_release"
                } else {
                    "ensemble_breath"
                }
            } else if character_count == 2 {
                if is_primary_explosion || is_secondary_explosion {
                    "equals_to_lead"
                } else if is_aftershock || is_resolution || arc_role == "outro" {
                    "lead_to_release"
                } else {
                    "balanced_to_turn"
                }
            } else if character_count == 1 {
                if is_resolution || arc_role == "outro" {
                    "solo_release"
                } else {
                    "solo_hold"
                }
            } else {
                "environment_hold"
            };
            ShotPlan {
                scene_id: scene.id,
                shot_size: shot_size.to_string(),
                shot_distance_preference: shot_distance_preference.to_string(),
                ensemble_mode: ensemble_mode.to_string(),
                movement: movement.to_string(),
                pacing: pacing.to_string(),
                lens_profile: lens_profile.to_string(),
                director_intent,
                motion_intensity,
                transition_style: transition_style.to_string(),
                transition_secs,
                motif_target_scene_id,
                motif_callback_style: motif_callback_style.to_string(),
                relationship_arc: relationship_arc.to_string(),
            }
        })
        .collect()
}
