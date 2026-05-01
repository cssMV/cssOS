use anyhow::Result;
use serde::{Deserialize, Serialize};

use super::types::RenderAdapterInput;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailRenderSpec {
    pub enabled: bool,
    pub duration_secs: f32,
    pub scene_ids: Vec<u32>,
    pub teaser_prompt: String,
    pub transition_strategy: String,
    pub style_tokens: Vec<String>,
}

pub fn build_thumbnail_spec(input: &RenderAdapterInput) -> Result<ThumbnailRenderSpec> {
    if !input.thumbnail.enabled {
        return Ok(ThumbnailRenderSpec {
            enabled: false,
            duration_secs: 0.0,
            scene_ids: Vec::new(),
            teaser_prompt: String::new(),
            transition_strategy: "disabled".to_string(),
            style_tokens: Vec::new(),
        });
    }
    let duration_secs = input.thumbnail.duration_secs.unwrap_or(4.0).clamp(3.0, 5.0);
    let mut scene_ids = input
        .director_plan
        .highlight_plan
        .thumbnail_candidate_scene_ids
        .clone();
    if scene_ids.is_empty() {
        scene_ids = input
            .director_plan
            .highlight_plan
            .hero_scene_ids
            .iter()
            .copied()
            .take(3)
            .collect();
    }
    if scene_ids.is_empty() {
        scene_ids = input.scenes.iter().take(3).map(|scene| scene.id).collect();
    }
    let teaser_prompt = format!(
        "{}, teaser for the full work, {}",
        input.project_prompt,
        input
            .style_profile
            .visual_tone
            .clone()
            .unwrap_or_else(|| "cinematic".to_string())
    );
    Ok(ThumbnailRenderSpec {
        enabled: true,
        duration_secs,
        scene_ids,
        teaser_prompt,
        transition_strategy: "hero-moment montage".to_string(),
        style_tokens: vec![
            input.style_profile.genre.clone(),
            input
                .style_profile
                .color_palette
                .clone()
                .unwrap_or_default(),
            input.style_profile.visual_tone.clone().unwrap_or_default(),
        ]
        .into_iter()
        .filter(|value| !value.is_empty())
        .collect(),
    })
}
