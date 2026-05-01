use std::collections::{BTreeMap, BTreeSet};

use crate::video::types::SceneInput;

use super::{CharacterProfile, ContinuityScore, ShotPlan, ShotType, StyleProfile};

pub fn score_continuity(
    scenes: &[SceneInput],
    shot_plans: &[ShotPlan],
    style: &StyleProfile,
    characters: &[CharacterProfile],
) -> Vec<ContinuityScore> {
    let shot_map = shot_plans
        .iter()
        .map(|plan| (plan.scene_id, plan))
        .collect::<BTreeMap<_, _>>();
    let known_characters = characters
        .iter()
        .map(|profile| profile.id.clone())
        .collect::<BTreeSet<_>>();
    scenes
        .iter()
        .map(|scene| {
            let mut warnings = Vec::new();
            let character_hits = scene
                .entities
                .characters
                .iter()
                .filter(|value| known_characters.contains(&value.trim().to_ascii_lowercase()))
                .count() as f32;
            let expected_characters = scene.entities.characters.len().max(1) as f32;
            let character_score = (character_hits / expected_characters).clamp(0.0, 1.0);
            if character_score < 0.75 {
                warnings.push("character binding incomplete".to_string());
            }
            let style_score = if style.style_tokens.is_empty() {
                0.5
            } else {
                0.95
            };
            let shot_score = shot_map
                .get(&scene.id)
                .map(|plan| {
                    let section = scene.section_type.to_ascii_lowercase();
                    match (section.as_str(), plan.primary_shot) {
                        ("chorus", ShotType::Tracking | ShotType::Wide) => 0.95,
                        ("verse", ShotType::Medium | ShotType::Static) => 0.92,
                        ("bridge", ShotType::Aerial | ShotType::Tracking) => 0.9,
                        _ => 0.76,
                    }
                })
                .unwrap_or_else(|| {
                    warnings.push("missing shot plan".to_string());
                    0.4
                });
            let overall_score =
                ((character_score * 0.35) + (style_score * 0.35) + (shot_score * 0.30))
                    .clamp(0.0, 1.0);
            ContinuityScore {
                scene_id: scene.id,
                character_score,
                style_score,
                shot_score,
                overall_score,
                warnings,
            }
        })
        .collect()
}
