use serde::{Deserialize, Serialize};

use crate::dag_v3::types::*;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SourceAsset {
    pub kind: InputKind,
    pub path: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub lang: Option<LangCode>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct Intent {
    pub mode: ProjectMode,
    pub primary_lang: String,
    #[serde(default)]
    pub target_langs: Vec<String>,
    #[serde(default)]
    pub target_voices: Vec<String>,
    #[serde(default)]
    pub karaoke: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreativeIntent {
    pub mode: ProjectMode,
    pub primary_lang: LangCode,
    pub target_langs: Vec<LangCode>,
    pub target_voices: Vec<VoiceId>,
    pub outputs: Vec<OutputKind>,
    pub karaoke: bool,
    pub auto_mv: bool,
    pub market_ready: bool,
    #[serde(default)]
    pub source_assets: Vec<SourceAsset>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CreativeBrief {
    pub title: String,
    pub style: String,
    pub mood: String,
    pub tempo: String,
    pub prompt: String,
    pub visual_prompt: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub enum CreateMode {
    #[default]
    FromScratch,
    MusicToMv,
    VocalToSong,
    VideoToKaraoke,
    Remix,
}
