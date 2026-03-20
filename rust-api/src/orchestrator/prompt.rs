use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum InputType {
    Voice,
    Text,
    Click,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct MvPrompt {
    pub title: String,
    pub style: String,
    pub mood: String,
    pub tempo: String,
    pub lang: String,
    pub lyrics_prompt: String,
    pub video_prompt: String,
}

pub fn build_prompt(
    input_type: &InputType,
    voice_url: Option<&str>,
    text_prompt: Option<&str>,
    lang: &str,
) -> MvPrompt {
    let resolved_lang = if lang.trim().is_empty() || lang.eq_ignore_ascii_case("auto") {
        "auto".to_string()
    } else {
        lang.trim().to_string()
    };

    match input_type {
        InputType::Text => {
            let seed = text_prompt.unwrap_or("Midnight neon skyline").trim();
            MvPrompt {
                title: truncate_title(seed),
                style: "cinematic synth-pop".to_string(),
                mood: "uplifting".to_string(),
                tempo: "112".to_string(),
                lang: resolved_lang,
                lyrics_prompt: format!("Write lyrics themed around: {seed}"),
                video_prompt: format!("Neon city narrative around: {seed}"),
            }
        }
        InputType::Voice => {
            let hint = voice_url.unwrap_or("voice_input");
            MvPrompt {
                title: "Voice Trigger MV".to_string(),
                style: "future bass".to_string(),
                mood: "emotional".to_string(),
                tempo: "96".to_string(),
                lang: resolved_lang,
                lyrics_prompt: format!("STT transcript from voice source ({hint}) as lyric theme"),
                video_prompt: "Emotion-driven music video with intimate close-up shots".to_string(),
            }
        }
        InputType::Click => {
            let themes = [
                "Aurora over glass ocean",
                "Cyberpunk rain and sunrise",
                "Mountain temple in clouds",
                "Moonlit train to nowhere",
            ];
            let idx = (chrono::Utc::now()
                .timestamp_nanos_opt()
                .unwrap_or(0)
                .unsigned_abs() as usize)
                % themes.len();
            let seed = themes[idx];
            MvPrompt {
                title: truncate_title(seed),
                style: "electro orchestral".to_string(),
                mood: "epic".to_string(),
                tempo: "124".to_string(),
                lang: resolved_lang,
                lyrics_prompt: format!("Generate a catchy chorus + verses about: {seed}"),
                video_prompt: format!("High-energy MV storyboard about: {seed}"),
            }
        }
    }
}

fn truncate_title(s: &str) -> String {
    let clean = s.trim();
    if clean.is_empty() {
        return "Untitled MV".to_string();
    }
    clean.chars().take(48).collect::<String>()
}
