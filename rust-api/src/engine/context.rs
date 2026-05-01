use serde::{Deserialize, Serialize};

use crate::video::render_adapter::{
    CharacterLockLite, DirectorPlanLite, MemoryPlanLite, RenderPlan,
};
use crate::video::types::{ProjectStyleInput, SceneInput, ThumbnailInput};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContentContext {
    pub project_id: String,
    pub prompt: String,
    pub scenes: Vec<SceneInput>,
    pub music_path: String,
    pub music_duration_secs: f32,
    pub thumbnail: ThumbnailInput,
    pub style_profile: ProjectStyleInput,
    pub director_plan: Option<DirectorPlanLite>,
    pub memory_plan: Option<MemoryPlanLite>,
    pub character_lock: Option<CharacterLockLite>,
    pub render_plan: Option<RenderPlan>,
    pub scene_videos: Vec<String>,
    pub final_video: Option<String>,
}
