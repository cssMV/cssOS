use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProjectInput {
    pub project_id: String,
    pub project_prompt: String,
    pub music: MusicInput,
    pub thumbnail: ThumbnailRequest,
    pub style_profile: StyleProfile,
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
pub struct ThumbnailRequest {
    pub enabled: bool,
    pub duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct StyleProfile {
    pub genre: String,
    pub color_palette: Option<String>,
    pub visual_tone: Option<String>,
    pub camera_language: Option<String>,
    pub quality_profile: Option<QualityProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DirectorGuidance {
    pub emotional_beat: Option<String>,
    pub energy_profile: Option<String>,
    pub shot_type: Option<String>,
    pub camera_move: Option<String>,
    pub camera_language: Option<String>,
    pub director_notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct QualityProfile {
    pub motion_intensity: Option<f32>,
    pub cut_density: Option<f32>,
    pub continuity_priority: Option<f32>,
    pub performance_focus: Option<f32>,
    pub chorus_impact: Option<f32>,
    pub avoid_static_frames: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneInput {
    pub id: usize,
    pub section_type: String,
    pub text_block: String,
    pub visual_script: String,
    pub duration_secs: f32,
    pub entities: SceneEntities,
    #[serde(default)]
    pub reference_media_paths: Vec<String>,
    pub director: Option<DirectorGuidance>,
    pub quality: Option<QualityProfile>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SceneEntities {
    pub characters: Vec<String>,
    pub location: String,
    pub props: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ThumbnailResult {
    pub enabled: bool,
    pub generated: bool,
    pub video_path: Option<String>,
    pub duration_secs: Option<f32>,
    pub source_scene_ids: Vec<usize>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ComposeResult {
    pub final_video_path: String,
    pub matched: bool,
    pub duration_delta_secs: f32,
    pub output_duration_secs: f32,
    pub music_duration_secs: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoSourceDiagnostic {
    pub scene_id: usize,
    pub source_mode: String,
    pub reference_media_count: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterProfile {
    pub name: String,
    pub scene_ids: Vec<usize>,
    pub primary_locations: Vec<String>,
    pub props: Vec<String>,
    pub visual_anchor: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NormalizedStyleProfile {
    pub genre: String,
    pub color_palette: String,
    pub visual_tone: String,
    pub camera_language: String,
    pub consistency_seed: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ShotPlan {
    pub scene_id: usize,
    pub shot_size: String,
    pub shot_distance_preference: String,
    pub ensemble_mode: String,
    pub movement: String,
    pub pacing: String,
    pub lens_profile: String,
    pub director_intent: String,
    pub motion_intensity: f32,
    pub transition_style: String,
    pub transition_secs: f32,
    pub motif_target_scene_id: Option<usize>,
    pub motif_callback_style: String,
    pub relationship_arc: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ArcTimelineBeat {
    pub scene_id: usize,
    pub section_role: String,
    pub sequence_index: usize,
    pub start_secs: f32,
    pub end_secs: f32,
    pub progress_ratio: f32,
    pub energy_phase: String,
    pub explosion_rank: usize,
    pub is_primary_explosion: bool,
    pub is_secondary_explosion: bool,
    pub is_aftershock: bool,
    pub is_resolution: bool,
    pub impact_weight: f32,
    pub stability_weight: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContinuityScore {
    pub scene_id: usize,
    pub character_score: f32,
    pub style_score: f32,
    pub shot_score: f32,
    pub overall_score: f32,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VideoProjectResult {
    pub thumbnail: ThumbnailResult,
    pub scene_video_paths: Vec<String>,
    pub compose_result: ComposeResult,
    pub video_source_mode: String,
    pub scene_source_diagnostics: Vec<VideoSourceDiagnostic>,
    pub continuity_scores: Vec<ContinuityScore>,
    pub character_profiles: Vec<CharacterProfile>,
    pub normalized_style: NormalizedStyleProfile,
    pub arc_timeline: Vec<ArcTimelineBeat>,
    pub shot_plans: Vec<ShotPlan>,
}
