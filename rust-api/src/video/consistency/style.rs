use crate::video::types::{ProjectStyleInput, SceneInput};

use super::StyleProfile;

pub fn normalize_style(input: &ProjectStyleInput) -> StyleProfile {
    let genre = if input.genre.trim().is_empty() {
        "cinematic".to_string()
    } else {
        input.genre.trim().to_ascii_lowercase()
    };
    let color_palette = input
        .color_palette
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty());
    let visual_tone = input
        .visual_tone
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .or_else(|| Some(default_visual_tone(&genre).to_string()));
    let camera_language = input
        .camera_language
        .as_ref()
        .map(|value| value.trim().to_ascii_lowercase())
        .filter(|value| !value.is_empty())
        .or_else(|| Some(default_camera_language(&genre).to_string()));
    let mut style_tokens = vec![genre.clone()];
    if let Some(value) = color_palette.as_ref() {
        style_tokens.push(value.clone());
    }
    if let Some(value) = visual_tone.as_ref() {
        style_tokens.push(value.clone());
    }
    if let Some(value) = camera_language.as_ref() {
        style_tokens.push(value.clone());
    }
    StyleProfile {
        genre,
        color_palette,
        visual_tone,
        camera_language,
        style_tokens,
    }
}

fn default_visual_tone(genre: &str) -> &'static str {
    match genre {
        "epic" => "heroic",
        "opera" => "ornate",
        "western" => "dusty",
        _ => "cinematic",
    }
}

fn default_camera_language(genre: &str) -> &'static str {
    match genre {
        "epic" => "sweeping",
        "western" => "anamorphic",
        "opera" => "staged",
        _ => "narrative",
    }
}

#[allow(dead_code)]
pub fn infer_style_from_scenes(input: &ProjectStyleInput, _scenes: &[SceneInput]) -> StyleProfile {
    normalize_style(input)
}

#[cfg(test)]
mod tests {
    use crate::video::types::ProjectStyleInput;

    use super::normalize_style;

    #[test]
    fn normalize_style_sets_defaults_and_tokens() {
        let style = normalize_style(&ProjectStyleInput {
            genre: "Epic".into(),
            color_palette: None,
            visual_tone: None,
            camera_language: None,
        });
        assert_eq!(style.genre, "epic");
        assert_eq!(style.visual_tone.as_deref(), Some("heroic"));
        assert_eq!(style.camera_language.as_deref(), Some("sweeping"));
        assert!(style.style_tokens.iter().any(|token| token == "epic"));
    }
}
