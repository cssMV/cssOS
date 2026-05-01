use std::collections::hash_map::DefaultHasher;
use std::hash::{Hash, Hasher};

use crate::video::contracts::{NormalizedStyleProfile, SceneInput, StyleProfile};

pub fn normalize_style(profile: &StyleProfile, scenes: &[SceneInput]) -> NormalizedStyleProfile {
    let joined_scripts = scenes
        .iter()
        .map(|scene| scene.visual_script.as_str())
        .collect::<Vec<_>>()
        .join("|");
    let mut hasher = DefaultHasher::new();
    profile.genre.hash(&mut hasher);
    profile.color_palette.hash(&mut hasher);
    profile.visual_tone.hash(&mut hasher);
    profile.camera_language.hash(&mut hasher);
    joined_scripts.hash(&mut hasher);

    NormalizedStyleProfile {
        genre: if profile.genre.trim().is_empty() {
            "cinematic".to_string()
        } else {
            profile.genre.clone()
        },
        color_palette: profile
            .color_palette
            .clone()
            .unwrap_or_else(|| "emerald-cyan-gold".to_string()),
        visual_tone: profile
            .visual_tone
            .clone()
            .unwrap_or_else(|| "high-contrast lyrical fantasy".to_string()),
        camera_language: profile
            .camera_language
            .clone()
            .unwrap_or_else(|| "gliding cinematic motion".to_string()),
        consistency_seed: hasher.finish(),
    }
}
