use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RawVideoRecord {
    pub id: String,
    pub source_uri: String,
    pub local_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClipRecord {
    pub clip_id: String,
    pub video_id: String,
    pub start_sec: f32,
    pub end_sec: f32,
    pub fps: u32,
    pub width: u32,
    pub height: u32,
    pub clip_path: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CaptionRecord {
    pub clip_id: String,
    pub summary: String,
    pub characters: Vec<String>,
    pub actions: Vec<String>,
    pub environment: Vec<String>,
    pub emotion: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FilterResult {
    pub clip_id: String,
    pub accepted: bool,
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ManifestRecord {
    pub clip: ClipRecord,
    pub caption: CaptionRecord,
}
