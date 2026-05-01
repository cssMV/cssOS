use std::collections::{BTreeMap, BTreeSet};

use crate::video::contracts::{CharacterProfile, SceneInput};

pub fn build_character_profiles(scenes: &[SceneInput]) -> Vec<CharacterProfile> {
    let mut map: BTreeMap<String, CharacterAccumulator> = BTreeMap::new();

    for scene in scenes {
        for name in &scene.entities.characters {
            let entry = map.entry(name.clone()).or_default();
            entry.scene_ids.push(scene.id);
            if !scene.entities.location.trim().is_empty() {
                entry.locations.insert(scene.entities.location.clone());
            }
            for prop in &scene.entities.props {
                entry.props.insert(prop.clone());
            }
            entry.visual_tokens.push(scene.visual_script.clone());
        }
    }

    map.into_iter()
        .map(|(name, acc)| CharacterProfile {
            name,
            scene_ids: acc.scene_ids,
            primary_locations: acc.locations.into_iter().collect(),
            props: acc.props.into_iter().collect(),
            visual_anchor: acc
                .visual_tokens
                .into_iter()
                .find(|token| !token.trim().is_empty())
                .unwrap_or_else(|| "consistent protagonist framing".to_string()),
        })
        .collect()
}

#[derive(Default)]
struct CharacterAccumulator {
    scene_ids: Vec<usize>,
    locations: BTreeSet<String>,
    props: BTreeSet<String>,
    visual_tokens: Vec<String>,
}

#[derive(Debug, Clone)]
pub struct CharacterContinuityMemory {
    pub recurring_characters: Vec<String>,
    pub focal_character: Option<String>,
    pub anchor_location: Option<String>,
    pub anchor_prop: Option<String>,
    pub framing_stability: f32,
    pub composition_preference: String,
    pub shot_distance_preference: String,
    pub ensemble_mode: String,
    pub focal_center_bias: f32,
    pub relationship_mode: String,
    pub formation_balance: f32,
    pub protagonist_priority: f32,
}

pub fn build_scene_continuity_memory(
    scene: &SceneInput,
    profiles: &[CharacterProfile],
) -> CharacterContinuityMemory {
    let recurring_characters = scene
        .entities
        .characters
        .iter()
        .filter(|name| {
            profiles
                .iter()
                .find(|profile| profile.name == name.as_str())
                .map(|profile| profile.scene_ids.len() >= 2)
                .unwrap_or(false)
        })
        .cloned()
        .collect::<Vec<_>>();

    let anchor_location = recurring_characters
        .iter()
        .find_map(|name| {
            profiles
                .iter()
                .find(|profile| profile.name == name.as_str())
                .and_then(|profile| profile.primary_locations.first().cloned())
        })
        .or_else(|| {
            if scene.entities.location.trim().is_empty() {
                None
            } else {
                Some(scene.entities.location.clone())
            }
        });

    let anchor_prop = recurring_characters
        .iter()
        .find_map(|name| {
            profiles
                .iter()
                .find(|profile| profile.name == name.as_str())
                .and_then(|profile| profile.props.first().cloned())
        })
        .or_else(|| scene.entities.props.first().cloned());
    let focal_character = recurring_characters
        .first()
        .cloned()
        .or_else(|| scene.entities.characters.first().cloned());

    let framing_stability = if recurring_characters.is_empty() {
        0.58
    } else if recurring_characters.len() >= 2 {
        0.9
    } else {
        0.78
    };
    let total_characters = scene.entities.characters.len();
    let composition_preference = if total_characters >= 3 {
        "ensemble_arc"
    } else if recurring_characters.len() >= 2 || total_characters == 2 {
        "center_duo"
    } else if !recurring_characters.is_empty() {
        "hero_center"
    } else if !scene.entities.characters.is_empty() {
        "left_anchor"
    } else {
        "free_frame"
    };
    let shot_distance_preference = if total_characters >= 3 {
        "wide_ensemble"
    } else if total_characters == 2 {
        "medium_duo"
    } else if !scene.entities.characters.is_empty() {
        if recurring_characters.is_empty() {
            "close_intro"
        } else {
            "hero_close"
        }
    } else {
        "environmental"
    };
    let ensemble_mode = if total_characters >= 3 {
        "group"
    } else if total_characters == 2 {
        "duo"
    } else if total_characters == 1 {
        "solo"
    } else {
        "environment"
    };
    let relationship_mode = if total_characters >= 4 {
        "ensemble-led"
    } else if total_characters == 3 {
        "triangle-led"
    } else if total_characters == 2 {
        if recurring_characters.len() >= 2 {
            "paired-equals"
        } else {
            "lead-support"
        }
    } else if total_characters == 1 {
        "solo-focus"
    } else {
        "environmental"
    };
    let protagonist_priority = if total_characters >= 3 {
        0.88
    } else if recurring_characters.len() >= 2 {
        0.92
    } else if !recurring_characters.is_empty() {
        0.84
    } else if !scene.entities.characters.is_empty() {
        0.72
    } else {
        0.5
    };
    let focal_center_bias = if let Some(name) = focal_character.as_deref() {
        let focal_hash = name.chars().fold(0_u64, |acc, ch| {
            acc.wrapping_mul(109).wrapping_add(ch as u64)
        });
        0.42 + ((focal_hash % 12) as f32 / 200.0)
    } else {
        0.48
    };
    let formation_balance = match relationship_mode {
        "ensemble-led" => 0.82,
        "triangle-led" => 0.74,
        "paired-equals" => 0.68,
        "lead-support" => 0.46,
        "solo-focus" => 0.22,
        _ => 0.5,
    };

    CharacterContinuityMemory {
        recurring_characters,
        focal_character,
        anchor_location,
        anchor_prop,
        framing_stability,
        composition_preference: composition_preference.to_string(),
        shot_distance_preference: shot_distance_preference.to_string(),
        ensemble_mode: ensemble_mode.to_string(),
        focal_center_bias,
        relationship_mode: relationship_mode.to_string(),
        formation_balance,
        protagonist_priority,
    }
}
