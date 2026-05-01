pub mod anchor;
pub mod matcher;
pub mod prompt;
pub mod types;

pub use types::{CharacterCandidate, CharacterProfile};

use anyhow::{anyhow, Result};

use crate::video::character_v2::anchor::generate_anchor;
use crate::video::character_v2::prompt::build_character_prompt;
use crate::video::openai_client::generate_images;
use crate::video::script_parser::script_to_prompt;

pub fn generate_character_consistent_images(
    api_key: &str,
    profile: &mut CharacterProfile,
    scene_prompt: &str,
    count: usize,
) -> Result<Vec<String>> {
    if profile.anchor_path.is_none() {
        generate_anchor(api_key, profile)?;
    }

    let strict_scene_prompt = script_to_prompt(scene_prompt);
    let prompt = build_character_prompt(profile, &strict_scene_prompt);
    let images = generate_images(api_key, &prompt, count, 999)?;
    let mut candidates = Vec::new();

    for image in images {
        let metadata = std::fs::metadata(&image)?;
        candidates.push(CharacterCandidate {
            image_path: image,
            score: metadata.len() as f32,
        });
    }

    candidates.sort_by(|a, b| {
        b.score
            .partial_cmp(&a.score)
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    if candidates.is_empty() {
        return Err(anyhow!("no character candidate"));
    }
    Ok(candidates
        .into_iter()
        .take(count.max(1))
        .map(|candidate| candidate.image_path)
        .collect())
}
