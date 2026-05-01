use serde::{Deserialize, Serialize};

use crate::video::consistency::{CharacterProfile, ContinuityScore, ShotPlan, StyleProfile};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInput {
    pub project_id: String,
    pub project_prompt: String,
    pub music: MusicInput,
    pub thumbnail: ThumbnailInput,
    pub style_profile: ProjectStyleInput,
    #[serde(default)]
    pub reference_media_paths: Vec<String>,
    pub scenes: Vec<SceneInput>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MusicInput {
    pub audio_path: String,
    pub duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailInput {
    pub enabled: bool,
    pub duration_secs: Option<f32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProjectStyleInput {
    pub genre: String,
    pub color_palette: Option<String>,
    pub visual_tone: Option<String>,
    pub camera_language: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneInput {
    pub id: u32,
    pub section_type: String,
    pub text_block: String,
    pub visual_script: String,
    pub duration_secs: f32,
    pub entities: SceneEntities,
    #[serde(default)]
    pub reference_media_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SceneEntities {
    #[serde(default)]
    pub characters: Vec<String>,
    pub location: Option<String>,
    #[serde(default)]
    pub props: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailVideoResult {
    pub enabled: bool,
    pub generated: bool,
    pub duration_secs: f32,
    pub output_path: Option<String>,
    pub source_scene_ids: Vec<u32>,
    pub message: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeResult {
    pub output_path: String,
    pub video_duration_secs: f32,
    pub audio_duration_secs: f32,
    pub duration_delta_secs: f32,
    pub matched: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneRenderPlan {
    pub output_path: String,
    pub shot_plan: ShotPlan,
    pub style_profile: StyleProfile,
    #[serde(default)]
    pub character_profiles: Vec<CharacterProfile>,
    pub reference_media_path: Option<String>,
    #[serde(default)]
    pub consistency_tokens: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneRenderResult {
    pub scene_id: u32,
    pub video_path: String,
    pub success: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoProjectResult {
    pub thumbnail: ThumbnailVideoResult,
    pub scene_video_paths: Vec<String>,
    pub compose_result: ComposeResult,
    pub continuity_scores: Vec<ContinuityScore>,
}
