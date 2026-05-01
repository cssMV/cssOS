use std::collections::BTreeSet;

use super::types::{
    ProjectStyleInput, SceneCharacterPromptLite, SceneDirectionLite, SceneInput, SceneMemoryLite,
};

pub fn compose_render_prompt(
    project_prompt: &str,
    scene: &SceneInput,
    direction: Option<&SceneDirectionLite>,
    memory: Option<&SceneMemoryLite>,
    character_prompt: Option<&SceneCharacterPromptLite>,
    style: &ProjectStyleInput,
) -> String {
    let mut parts = vec![
        project_prompt.trim().to_string(),
        scene.visual_script.trim().to_string(),
    ];
    if !scene.text_block.trim().is_empty() {
        parts.push(format!("lyric context: {}", scene.text_block.trim()));
    }
    if let Some(direction) = direction {
        parts.push(format!(
            "emotion {} intensity {:.2} narrative role {}",
            direction.emotion, direction.emotion_intensity, direction.narrative_role
        ));
        parts.push(format!(
            "camera {} motion {} focus {}",
            direction.camera_hint, direction.motion_hint, direction.visual_focus
        ));
    }
    if let Some(memory) = memory {
        parts.push(format!(
            "story phase {} memory {}",
            memory.story_phase, memory.memory_summary
        ));
    }
    if let Some(character_prompt) = character_prompt {
        parts.extend(character_prompt.prompts.iter().cloned());
    }
    if let Some(tone) = style.visual_tone.as_ref() {
        parts.push(format!("visual tone {}", tone));
    }
    if let Some(camera_language) = style.camera_language.as_ref() {
        parts.push(format!("camera language {}", camera_language));
    }
    if let Some(color_palette) = style.color_palette.as_ref() {
        parts.push(format!("palette {}", color_palette));
    }
    dedupe_csv_like(parts)
}

pub fn compose_negative_prompt(
    _scene: &SceneInput,
    direction: Option<&SceneDirectionLite>,
) -> Option<String> {
    let mut negatives = vec![
        "low detail".to_string(),
        "blurry face".to_string(),
        "inconsistent costume".to_string(),
        "extra limbs".to_string(),
        "distorted anatomy".to_string(),
        "text watermark logo".to_string(),
    ];
    if let Some(direction) = direction {
        if direction.emotion_intensity > 0.75 {
            negatives.push("flat emotion".to_string());
        }
        if direction
            .visual_focus
            .to_ascii_lowercase()
            .contains("character")
        {
            negatives.push("background dominates subject".to_string());
        }
    }
    Some(dedupe_csv_like(negatives))
}

fn dedupe_csv_like(parts: Vec<String>) -> String {
    let mut seen = BTreeSet::new();
    let mut result = Vec::new();
    for value in parts {
        let trimmed = value.trim();
        if trimmed.is_empty() {
            continue;
        }
        let lowered = trimmed.to_ascii_lowercase();
        if seen.insert(lowered) {
            result.push(trimmed.to_string());
        }
    }
    result.join(", ")
}
