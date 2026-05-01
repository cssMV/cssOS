use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterProfile {
    pub id: String,
    pub display_name: String,
    pub outfit: Option<String>,
    pub accessories: Vec<String>,
    pub visual_keywords: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct StyleProfile {
    pub genre: String,
    pub color_palette: Option<String>,
    pub visual_tone: Option<String>,
    pub camera_language: Option<String>,
    pub style_tokens: Vec<String>,
}

#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq, Eq)]
pub enum ShotType {
    Wide,
    Medium,
    CloseUp,
    Tracking,
    Static,
    Aerial,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotPlan {
    pub scene_id: u32,
    pub primary_shot: ShotType,
    pub motion_hint: String,
    pub transition_hint: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuityScore {
    pub scene_id: u32,
    pub character_score: f32,
    pub style_score: f32,
    pub shot_score: f32,
    pub overall_score: f32,
    pub warnings: Vec<String>,
}
