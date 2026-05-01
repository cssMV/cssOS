use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RenderAdapterInput {
    pub project_id: String,
    pub project_prompt: String,
    pub music: MusicInput,
    pub thumbnail: ThumbnailInput,
    pub scenes: Vec<SceneInput>,
    pub director_plan: DirectorPlanLite,
    pub memory_plan: MemoryPlanLite,
    pub character_lock: CharacterLockLite,
    pub style_profile: ProjectStyleInput,
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
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct SceneEntities {
    pub characters: Vec<String>,
    pub location: Option<String>,
    pub props: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DirectorPlanLite {
    pub scene_directions: Vec<SceneDirectionLite>,
    pub transition_plan: Vec<TransitionDirectiveLite>,
    pub highlight_plan: HighlightPlanLite,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneDirectionLite {
    pub scene_id: u32,
    pub emotion: String,
    pub emotion_intensity: f32,
    pub narrative_role: String,
    pub rhythm_density: String,
    pub recommended_shot_changes: u32,
    pub camera_hint: String,
    pub motion_hint: String,
    pub visual_focus: String,
    pub priority: f32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransitionDirectiveLite {
    pub from_scene_id: u32,
    pub to_scene_id: u32,
    pub transition: String,
    pub reason: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct HighlightPlanLite {
    pub hero_scene_ids: Vec<u32>,
    pub thumbnail_candidate_scene_ids: Vec<u32>,
    pub climax_scene_ids: Vec<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct MemoryPlanLite {
    pub scene_memories: Vec<SceneMemoryLite>,
    pub carry_over_bindings: Vec<CarryOverBindingLite>,
    pub warnings: Vec<MemoryWarningLite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneMemoryLite {
    pub scene_id: u32,
    pub inherited_from_scene_id: Option<u32>,
    pub story_phase: String,
    pub memory_summary: String,
    pub active_characters: Vec<CharacterStateLite>,
    pub active_location: Option<LocationStateLite>,
    pub active_props: Vec<PropStateLite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterStateLite {
    pub character_id: String,
    pub emotional_state: Option<String>,
    pub physical_state: Option<String>,
    pub wardrobe_state: Option<String>,
    pub action_state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocationStateLite {
    pub location_id: String,
    pub atmosphere: Option<String>,
    pub time_of_day: Option<String>,
    pub weather: Option<String>,
    pub damage_state: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PropStateLite {
    pub prop_id: String,
    pub owner: Option<String>,
    pub condition: Option<String>,
    pub relevance: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CarryOverBindingLite {
    pub from_scene_id: u32,
    pub to_scene_id: u32,
    pub carried_characters: Vec<String>,
    pub carried_props: Vec<String>,
    pub carried_location_context: Option<String>,
    pub notes: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MemoryWarningLite {
    pub scene_id: u32,
    pub level: String,
    pub message: String,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CharacterLockLite {
    pub profiles: Vec<CharacterProfileLite>,
    pub scene_prompts: Vec<SceneCharacterPromptLite>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CharacterProfileLite {
    pub id: String,
    pub base_prompt: String,
    pub anchor_images: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SceneCharacterPromptLite {
    pub scene_id: u32,
    pub prompts: Vec<String>,
}
