use crate::scene_semantics_engine::state::SceneSemanticState;
use crate::scene_semantics_engine::types::{SceneMood, SceneSemanticKind, SceneTensionLevel};
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct SceneSemanticPlanningInput {
    pub scene_id: String,
    #[serde(default)]
    pub tags: Vec<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dominant_relationship: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dominant_emotion: Option<String>,
}

pub fn plan_scene_semantics(input: &SceneSemanticPlanningInput) -> SceneSemanticState {
    let tagset = input.tags.join(",").to_lowercase();

    if tagset.contains("confession") || tagset.contains("love") {
        return SceneSemanticState {
            scene_id: input.scene_id.clone(),
            semantic: SceneSemanticKind::Confession,
            tension: SceneTensionLevel::Soft,
            mood: SceneMood::Romantic,
        };
    }
    if tagset.contains("betrayal") {
        return SceneSemanticState {
            scene_id: input.scene_id.clone(),
            semantic: SceneSemanticKind::Betrayal,
            tension: SceneTensionLevel::Critical,
            mood: SceneMood::Hostile,
        };
    }
    if tagset.contains("reveal") || tagset.contains("truth") {
        return SceneSemanticState {
            scene_id: input.scene_id.clone(),
            semantic: SceneSemanticKind::Revelation,
            tension: SceneTensionLevel::Critical,
            mood: SceneMood::Mysterious,
        };
    }
    if tagset.contains("explore") || tagset.contains("discovery") {
        return SceneSemanticState {
            scene_id: input.scene_id.clone(),
            semantic: SceneSemanticKind::Exploration,
            tension: SceneTensionLevel::Uncertain,
            mood: SceneMood::Mysterious,
        };
    }

    SceneSemanticState {
        scene_id: input.scene_id.clone(),
        semantic: SceneSemanticKind::Introduction,
        tension: SceneTensionLevel::Calm,
        mood: SceneMood::Warm,
    }
}
