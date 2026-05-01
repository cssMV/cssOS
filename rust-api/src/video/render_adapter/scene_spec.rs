use anyhow::{anyhow, Result};
use serde::{Deserialize, Serialize};

use super::prompt::{compose_negative_prompt, compose_render_prompt};
use super::types::{
    CharacterProfileLite, CharacterStateLite, LocationStateLite, ProjectStyleInput,
    RenderAdapterInput, SceneCharacterPromptLite, SceneDirectionLite, SceneInput, SceneMemoryLite,
};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneRenderSpec {
    pub scene_id: u32,
    pub duration_secs: f32,
    pub render_prompt: String,
    pub negative_prompt: Option<String>,
    pub camera_plan: CameraPlan,
    pub motion_plan: MotionPlan,
    pub transition_out: Option<String>,
    pub visual_focus: String,
    pub continuity_tokens: Vec<String>,
    pub character_refs: Vec<CharacterReference>,
    pub location_ref: Option<LocationReference>,
    pub prop_refs: Vec<PropReference>,
    pub quality_profile: QualityProfile,
    pub source_tags: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CameraPlan {
    pub primary_shot: String,
    pub camera_hint: String,
    pub shot_change_count: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MotionPlan {
    pub motion_hint: String,
    pub rhythm_density: String,
    pub transition_hint: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterReference {
    pub character_id: String,
    pub base_prompt: String,
    pub anchor_images: Vec<String>,
    pub state_tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationReference {
    pub location_id: String,
    pub state_tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropReference {
    pub prop_id: String,
    pub state_tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct QualityProfile {
    pub tier: String,
    pub target_style: String,
    pub consistency_weight: f32,
}

pub fn build_scene_spec(input: &RenderAdapterInput, scene: &SceneInput) -> Result<SceneRenderSpec> {
    if scene.duration_secs <= 0.0 {
        return Err(anyhow!("scene {} duration_secs must be positive", scene.id));
    }
    let direction = input
        .director_plan
        .scene_directions
        .iter()
        .find(|item| item.scene_id == scene.id);
    let memory = input
        .memory_plan
        .scene_memories
        .iter()
        .find(|item| item.scene_id == scene.id);
    let character_prompt = input
        .character_lock
        .scene_prompts
        .iter()
        .find(|item| item.scene_id == scene.id);
    let render_prompt = compose_render_prompt(
        &input.project_prompt,
        scene,
        direction,
        memory,
        character_prompt,
        &input.style_profile,
    );
    let transition_out = input
        .director_plan
        .transition_plan
        .iter()
        .find(|edge| edge.from_scene_id == scene.id)
        .map(|edge| edge.transition.clone());
    let continuity_tokens = build_continuity_tokens(scene, direction, memory);
    let character_refs = build_character_refs(
        scene,
        memory,
        character_prompt,
        &input.character_lock.profiles,
    );
    let location_ref = build_location_ref(scene, memory);
    let prop_refs = build_prop_refs(scene, memory);
    Ok(SceneRenderSpec {
        scene_id: scene.id,
        duration_secs: scene.duration_secs,
        render_prompt,
        negative_prompt: compose_negative_prompt(scene, direction),
        camera_plan: CameraPlan {
            primary_shot: infer_primary_shot(scene, direction, &input.style_profile),
            camera_hint: direction
                .map(|item| item.camera_hint.clone())
                .unwrap_or_else(|| {
                    input
                        .style_profile
                        .camera_language
                        .clone()
                        .unwrap_or_else(|| "narrative coverage".to_string())
                }),
            shot_change_count: direction
                .map(|item| item.recommended_shot_changes)
                .unwrap_or(1),
        },
        motion_plan: MotionPlan {
            motion_hint: direction
                .map(|item| item.motion_hint.clone())
                .unwrap_or_else(|| "motivated movement".to_string()),
            rhythm_density: direction
                .map(|item| item.rhythm_density.clone())
                .unwrap_or_else(|| "medium".to_string()),
            transition_hint: transition_out.clone(),
        },
        transition_out,
        visual_focus: direction
            .map(|item| item.visual_focus.clone())
            .unwrap_or_else(|| "story beat".to_string()),
        continuity_tokens,
        character_refs,
        location_ref,
        prop_refs,
        quality_profile: QualityProfile {
            tier: if input
                .director_plan
                .highlight_plan
                .climax_scene_ids
                .contains(&scene.id)
            {
                "hero".to_string()
            } else {
                "standard".to_string()
            },
            target_style: input
                .style_profile
                .visual_tone
                .clone()
                .unwrap_or_else(|| "cinematic".to_string()),
            consistency_weight: if scene.section_type.eq_ignore_ascii_case("chorus") {
                0.88
            } else {
                0.78
            },
        },
        source_tags: build_source_tags(direction, memory),
    })
}

fn infer_primary_shot(
    scene: &SceneInput,
    direction: Option<&SceneDirectionLite>,
    style: &ProjectStyleInput,
) -> String {
    if let Some(direction) = direction {
        if !direction.camera_hint.trim().is_empty() {
            return direction.camera_hint.clone();
        }
    }
    style.camera_language.clone().unwrap_or_else(|| {
        match scene.section_type.to_ascii_lowercase().as_str() {
            "chorus" => "wide tracking".to_string(),
            "bridge" => "contrast aerial".to_string(),
            _ => "medium narrative".to_string(),
        }
    })
}

fn build_continuity_tokens(
    scene: &SceneInput,
    direction: Option<&SceneDirectionLite>,
    memory: Option<&SceneMemoryLite>,
) -> Vec<String> {
    let mut tokens = Vec::new();
    if let Some(memory) = memory {
        tokens.push(format!("story_phase:{}", memory.story_phase));
        if let Some(location) = memory.active_location.as_ref() {
            tokens.push(format!("location:{}", location.location_id));
            if let Some(time_of_day) = location.time_of_day.as_ref() {
                tokens.push(format!("time:{}", time_of_day));
            }
        }
        for prop in &memory.active_props {
            tokens.push(format!("prop:{}", prop.prop_id));
        }
        for character in &memory.active_characters {
            if let Some(state) = dominant_character_state(character) {
                tokens.push(format!("emotion:{}", state));
                break;
            }
        }
    } else {
        tokens.push(format!("section:{}", scene.section_type));
    }
    if let Some(direction) = direction {
        tokens.push(format!("focus:{}", direction.visual_focus));
    }
    tokens.sort();
    tokens.dedup();
    tokens
}

fn build_character_refs(
    scene: &SceneInput,
    memory: Option<&SceneMemoryLite>,
    character_prompt: Option<&SceneCharacterPromptLite>,
    profiles: &[CharacterProfileLite],
) -> Vec<CharacterReference> {
    scene
        .entities
        .characters
        .iter()
        .map(|character_id| {
            let profile = profiles.iter().find(|item| &item.id == character_id);
            let state_tokens = memory
                .into_iter()
                .flat_map(|memory| memory.active_characters.iter())
                .find(|state| &state.character_id == character_id)
                .map(character_state_tokens)
                .unwrap_or_default();
            CharacterReference {
                character_id: character_id.clone(),
                base_prompt: character_prompt
                    .and_then(|entry| entry.prompts.first().cloned())
                    .or_else(|| profile.map(|entry| entry.base_prompt.clone()))
                    .unwrap_or_else(|| format!("character {}", character_id)),
                anchor_images: profile
                    .map(|entry| entry.anchor_images.clone())
                    .unwrap_or_default(),
                state_tokens,
            }
        })
        .collect()
}

fn build_location_ref(
    scene: &SceneInput,
    memory: Option<&SceneMemoryLite>,
) -> Option<LocationReference> {
    memory
        .and_then(|memory| memory.active_location.as_ref())
        .map(location_reference)
        .or_else(|| {
            scene
                .entities
                .location
                .as_ref()
                .map(|location| LocationReference {
                    location_id: location.clone(),
                    state_tokens: vec!["fallback_location".to_string()],
                })
        })
}

fn build_prop_refs(scene: &SceneInput, memory: Option<&SceneMemoryLite>) -> Vec<PropReference> {
    if let Some(memory) = memory {
        return memory
            .active_props
            .iter()
            .map(|prop| PropReference {
                prop_id: prop.prop_id.clone(),
                state_tokens: [
                    prop.condition.clone(),
                    prop.relevance.clone(),
                    prop.owner.clone(),
                ]
                .into_iter()
                .flatten()
                .collect(),
            })
            .collect();
    }
    scene
        .entities
        .props
        .iter()
        .map(|prop| PropReference {
            prop_id: prop.clone(),
            state_tokens: vec!["fallback_prop".to_string()],
        })
        .collect()
}

fn build_source_tags(
    direction: Option<&SceneDirectionLite>,
    memory: Option<&SceneMemoryLite>,
) -> Vec<String> {
    let mut tags = Vec::new();
    if direction.is_some() {
        tags.push("director_plan".to_string());
    } else {
        tags.push("director_fallback".to_string());
    }
    if memory.is_some() {
        tags.push("memory_plan".to_string());
    } else {
        tags.push("memory_fallback".to_string());
    }
    tags
}

fn character_state_tokens(state: &CharacterStateLite) -> Vec<String> {
    [
        state.emotional_state.clone(),
        state.physical_state.clone(),
        state.wardrobe_state.clone(),
        state.action_state.clone(),
    ]
    .into_iter()
    .flatten()
    .collect()
}

fn dominant_character_state(state: &CharacterStateLite) -> Option<String> {
    state
        .emotional_state
        .clone()
        .or_else(|| state.action_state.clone())
}

fn location_reference(location: &LocationStateLite) -> LocationReference {
    LocationReference {
        location_id: location.location_id.clone(),
        state_tokens: [
            location.atmosphere.clone(),
            location.time_of_day.clone(),
            location.weather.clone(),
            location.damage_state.clone(),
        ]
        .into_iter()
        .flatten()
        .collect(),
    }
}

#[cfg(test)]
mod tests {
    use super::build_scene_spec;
    use crate::video::render_adapter::types::*;

    #[test]
    fn scene_spec_keeps_scene_duration_and_prompt() {
        let input = RenderAdapterInput {
            project_id: "demo".into(),
            project_prompt: "epic love war".into(),
            music: MusicInput {
                audio_path: "audio.mp3".into(),
                duration_secs: 20.0,
            },
            thumbnail: ThumbnailInput {
                enabled: true,
                duration_secs: Some(4.0),
            },
            scenes: vec![SceneInput {
                id: 1,
                section_type: "verse".into(),
                text_block: "第一节".into(),
                visual_script: "hero rides through battlefield".into(),
                duration_secs: 12.0,
                entities: SceneEntities {
                    characters: vec!["male_lead".into()],
                    location: Some("battlefield".into()),
                    props: vec!["sword".into()],
                },
            }],
            director_plan: DirectorPlanLite::default(),
            memory_plan: MemoryPlanLite::default(),
            character_lock: CharacterLockLite::default(),
            style_profile: ProjectStyleInput {
                genre: "epic".into(),
                color_palette: Some("gold dusk".into()),
                visual_tone: Some("cinematic".into()),
                camera_language: Some("slow push".into()),
            },
        };
        let spec = build_scene_spec(&input, &input.scenes[0]).expect("scene spec");
        assert_eq!(spec.duration_secs, 12.0);
        assert!(!spec.render_prompt.is_empty());
        assert_eq!(spec.camera_plan.camera_hint, "slow push");
    }
}
