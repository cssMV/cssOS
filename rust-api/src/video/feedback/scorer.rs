use std::fs;

use image::GenericImageView;
use serde::{Deserialize, Serialize};

use super::RenderContext;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderScore {
    pub visual_quality: f32,
    pub character_consistency: f32,
    pub script_alignment: f32,
    pub style_consistency: f32,
    pub overall: f32,
}

pub fn score_image(image_path: &str, context: &RenderContext) -> RenderScore {
    let visual_quality = score_visual_quality(image_path);
    let prompt_lower = context.prompt.to_ascii_lowercase();
    let script_alignment = keyword_alignment(&context.visual_script, &prompt_lower);
    let style_consistency = keyword_alignment(
        &[
            context.style_profile.genre.clone(),
            context
                .style_profile
                .visual_tone
                .clone()
                .unwrap_or_default(),
            context
                .style_profile
                .camera_language
                .clone()
                .unwrap_or_default(),
            context
                .style_profile
                .color_palette
                .clone()
                .unwrap_or_default(),
        ]
        .join(" "),
        &prompt_lower,
    );
    let character_consistency = if context.character_profiles.is_empty() {
        0.75
    } else {
        let matched = context
            .character_profiles
            .iter()
            .filter(|profile| {
                let hay = format!(
                    "{} {} {} {}",
                    profile.id,
                    profile.display_name,
                    profile.outfit.clone().unwrap_or_default(),
                    profile.visual_keywords.join(" ")
                )
                .to_ascii_lowercase();
                prompt_lower.contains(&profile.id.to_ascii_lowercase())
                    || prompt_lower.contains(&profile.display_name.to_ascii_lowercase())
                    || hay
                        .split_whitespace()
                        .any(|token| prompt_lower.contains(token))
            })
            .count() as f32;
        (matched / context.character_profiles.len() as f32).clamp(0.0, 1.0)
    };
    let overall = (visual_quality * 0.35)
        + (character_consistency * 0.25)
        + (script_alignment * 0.20)
        + (style_consistency * 0.20);
    RenderScore {
        visual_quality,
        character_consistency,
        script_alignment,
        style_consistency,
        overall: overall.clamp(0.0, 1.0),
    }
}

fn score_visual_quality(image_path: &str) -> f32 {
    let metadata = match fs::metadata(image_path) {
        Ok(metadata) => metadata,
        Err(_) => {
            return 0.0;
        }
    };
    let image = match image::open(image_path) {
        Ok(image) => image,
        Err(_) => {
            return 0.1;
        }
    };
    let (w, h) = image.dimensions();
    let size_score: f32 = if metadata.len() > 120_000 {
        1.0
    } else if metadata.len() > 48_000 {
        0.75
    } else {
        0.35
    };
    let resolution_score: f32 = if w >= 1024 && h >= 768 {
        1.0
    } else if w >= 768 && h >= 512 {
        0.7
    } else {
        0.3
    };
    ((size_score * 0.45) + (resolution_score * 0.55)).clamp(0.0, 1.0)
}

fn keyword_alignment(source: &str, prompt_lower: &str) -> f32 {
    let keywords = source
        .split(|ch: char| !(ch.is_alphanumeric() || ch == '-'))
        .filter(|token| token.len() >= 4)
        .map(|token| token.to_ascii_lowercase())
        .collect::<Vec<_>>();
    if keywords.is_empty() {
        return 0.7;
    }
    let matched = keywords
        .iter()
        .filter(|token| prompt_lower.contains(token.as_str()))
        .count() as f32;
    (matched / keywords.len() as f32).clamp(0.0, 1.0)
}
